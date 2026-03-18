import React, { createContext } from "react";
import { SesionInterface } from "../interfaces/interfaces";

export type contextProps = {
  sesion: SesionInterface;
  setSesion: React.Dispatch<React.SetStateAction<SesionInterface>>;
  loading: boolean;
  logout: () => void;
};

export const SesionContext = createContext<contextProps>({} as contextProps);
