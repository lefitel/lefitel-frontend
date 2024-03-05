import React, { createContext } from "react";
import { SesionInterface } from "../interfaces/interfaces";
import { usuarioExample } from "../data/example";



type contextProps = {
  sesion: SesionInterface
  setSesion: React.Dispatch<React.SetStateAction<SesionInterface>>;
}

export const SesionContext = createContext<contextProps>({} as contextProps);

interface props {
  children: JSX.Element | JSX.Element[]
}

export const SesionProvider = ({ children }: props) => {
  const [sesion, setSesion] = React.useState<SesionInterface>({ token: "", usuario: usuarioExample });

  return (
    <SesionContext.Provider value={{ sesion, setSesion }}>
      {children}
    </SesionContext.Provider>
  );
};
