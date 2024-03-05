import { Navigate, Outlet, Route, Routes, HashRouter } from "react-router-dom";
import "./App.css";
import { SnackbarProvider } from "notistack";
import { SesionContext, SesionProvider } from "./context/SesionProvider";
import { useContext } from "react";
import { CssBaseline, createTheme } from "@mui/material";
import { ThemeProvider } from "@emotion/react";

import { esES as dataGridEs } from "@mui/x-data-grid";
import { esES as coreEs } from "@mui/material/locale";
import { esES as dateEs } from "@mui/x-date-pickers/locales";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";

const lightTheme = createTheme(
  {
    palette: {
      mode: "light",
      primary: { main: "#596BAB" },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: "capitalize",
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          variant: "filled",
          size: "small",
        },
        styleOverrides: {},
      },
      MuiTypography: {
        defaultProps: {},
      },
      MuiCard: {
        defaultProps: {
          variant: "outlined",
        },
      },
    },
  },
  dataGridEs,
  coreEs,
  dateEs
);

const PrivateRoutes = () => {
  const { sesion } = useContext(SesionContext);

  return sesion.token != "" ? <Outlet /> : <Navigate to="/login" />;
};

const App = () => {
  return (
    <SesionProvider>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <SnackbarProvider autoHideDuration={2000} maxSnack={2}>
          <ThemeProvider theme={lightTheme}>
            {/* Establece los estilos base para la aplicación */}
            <CssBaseline />
            <HashRouter>
              <Routes>
                <Route element={<PrivateRoutes />}>
                  <Route path="/*" element={<HomePage />} />
                </Route>
                <Route path="/login" element={<LoginPage />} />
              </Routes>
            </HashRouter>
          </ThemeProvider>
        </SnackbarProvider>
      </LocalizationProvider>
    </SesionProvider>
  );
};

export default App
