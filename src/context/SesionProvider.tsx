import React, { createContext } from "react";

type contextProps = {
  sesion: string
  setSesion: React.Dispatch<React.SetStateAction<string>> | undefined;
}

export const SesionContext = createContext<contextProps>({} as contextProps);

interface props {
  children: JSX.Element | JSX.Element[]
}

export const SesionProvider = ({ children }: props) => {
  const [sesion, setSesion] = React.useState<string>("");

  return (
    <SesionContext.Provider value={{ sesion, setSesion }}>
      {children}
    </SesionContext.Provider>
  );
};
