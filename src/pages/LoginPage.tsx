import {
  Button,
  Grid,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import logo from "../assets/images/logo.png";
import { useContext, useEffect, useState } from "react";
import { SesionContext } from "../context/SesionProvider";
import { useSnackbar } from "notistack";
import { useNavigate } from "react-router-dom";
import LoadingComponent from "../components/LoadingComponent";
import LoadingButton from "@mui/lab/LoadingButton";
import {
  AccountCircle,
  Key,
  KeyboardArrowRight,
  Person,
} from "@mui/icons-material";

const LoginPage = () => {
  const { setSesion } = useContext(SesionContext);
  const [login, setLogin] = useState({ user: "", password: "" });
  const [loading, setLoading] = useState(false);

  const { enqueueSnackbar } = useSnackbar();

  const navigater = useNavigate();
  useEffect(() => {
    ComprobarToken();
  });

  const ComprobarToken = () => {
    const TokenSesion = JSON.parse(window.localStorage.getItem("token"));

    if (TokenSesion) {
      //console.log("ComprobarToken");

      setSesion(TokenSesion);
      navigater("/home", { replace: true });
    }
  };
  const ValidarDatos = () => {
    if (login.user === "" || login.password === "") {
      return enqueueSnackbar("Rellena todos los espacios", {
        variant: "warning",
      });
    } else {
      setLoading(true);

      setTimeout(() => {
        if (login.user === "a" && login.password === "a") {
          window.localStorage.setItem("token", JSON.stringify(login.user));
          setSesion(login.user);
          navigater("/home", { replace: true });
        } else {
          enqueueSnackbar("Usuario o contraseña incorrectos", {
            variant: "error",
          });
        }
        setLoading(false);
      }, 3000);
    }
  };
  return (
    <div className="login-page">
      <Grid container gap={0.1} width={{ xs: 280, sm: 300, md: 350 }}>
        <Grid container gap={1}>
          <img src={logo} alt={"Logo"} loading="lazy" width={"60px"} />
          <Grid display={"flex"} alignItems={"end"}>
            <Typography variant="h2" lineHeight={0.7}>
              Lefitel
            </Typography>
            <Typography lineHeight={0.7}>srl</Typography>
          </Grid>
        </Grid>
        <hr />
        <Grid container flexDirection={"column"} gap={1}>
          <TextField
            fullWidth
            label="Usuario"
            //helperText="Usuario"
            inputProps={{ style: { textAlign: "center" } }}
            onChange={(e) => setLogin({ ...login, user: e.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                ValidarDatos();
              }
            }}
          />

          <TextField
            fullWidth
            //error
            label="Contraseña"
            //helperText="Incorrect entry."
            inputProps={{ style: { textAlign: "center" } }}
            type="password"
            onChange={(e) => setLogin({ ...login, password: e.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                ValidarDatos();
              }
            }}
          />
        </Grid>
        <Grid container>
          <LoadingButton
            fullWidth
            variant="contained"
            onClick={ValidarDatos}
            loading={loading}
            loadingPosition="end"
            endIcon={<KeyboardArrowRight />}
          >
            Entrar
          </LoadingButton>
        </Grid>
      </Grid>
    </div>
  );
};

export default LoginPage;
