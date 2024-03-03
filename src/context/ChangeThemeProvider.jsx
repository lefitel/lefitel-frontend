import { createTheme } from "@mui/material";
import React, { createContext } from "react";

const lightTheme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#596BAB" },
  },
});
const darkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#596BAB" },
  },
});

export const ChangeThemeContext = createContext();

// eslint-disable-next-line react/prop-types
export const ChangeThemeProvider = ({ children }) => {
  const [theme, setTheme] = React.useState(true);
  const changeTheme = () => {
    if (theme === true) {
      setTheme(false);
    } else {
      setTheme(true);
    }
  };

  return (
    <ChangeThemeContext.Provider value={{ theme, changeTheme }}>
      {children}
    </ChangeThemeContext.Provider>
  );
};
