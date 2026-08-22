import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImageDropzone } from "./image-dropzone";

/** jsdom implements neither, and the preview needs both. */
beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Which hidden input got clicked, told apart by its `capture` attribute. */
function watchInputClicks(): (string | null)[] {
  const clicked: (string | null)[] = [];
  vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (
    this: HTMLInputElement
  ) {
    clicked.push(this.getAttribute("capture"));
  });
  return clicked;
}

const photo = () => new File(["x"], "poste.jpg", { type: "image/jpeg" });

describe("ImageDropzone", () => {
  it("goes straight to the rear camera, and still allows an older photo", () => {
    const { container } = render(<ImageDropzone file={null} onChange={vi.fn()} />);
    const inputs = [...container.querySelectorAll<HTMLInputElement>('input[type="file"]')];

    // One aimed at the camera, one left free for the gallery. `capture` alone
    // would shut the gallery off entirely.
    expect(inputs.map((i) => i.getAttribute("capture"))).toStrictEqual(["environment", null]);
    expect(inputs.every((i) => i.accept === "image/*")).toBe(true);
  });

  it("sends «Hacer foto» to the camera and «Galería» to the picker", async () => {
    const user = userEvent.setup();
    const clicked = watchInputClicks();
    render(<ImageDropzone file={null} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Hacer foto/i }));
    expect(clicked).toStrictEqual(["environment"]);

    await user.click(screen.getByRole("button", { name: /Galería/i }));
    expect(clicked).toStrictEqual(["environment", null]);
  });

  it("keeps a way to replace a photo that does not depend on hovering", async () => {
    const user = userEvent.setup();
    const clicked = watchInputClicks();
    render(<ImageDropzone file={photo()} onChange={vi.fn()} />);

    // The overlay is a button, so it answers the keyboard; and the two below
    // it are there whether or not the device has a pointer.
    expect(screen.getByRole("button", { name: /Cambiar imagen/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Repetir foto/i }));
    expect(clicked).toStrictEqual(["environment"]);
  });

  it("releases the preview instead of leaking it", () => {
    const { unmount } = render(<ImageDropzone file={photo()} onChange={vi.fn()} />);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });

  it("shows nothing but the image when read-only", () => {
    render(<ImageDropzone file={null} onChange={vi.fn()} existingUrl="/p.jpg" readOnly />);

    expect(screen.getByAltText("preview")).toHaveAttribute("src", "/p.jpg");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
