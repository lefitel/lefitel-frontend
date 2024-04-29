import {
  Grid,
  TextField,
  Typography,
} from "@mui/material";
import logo from "../assets/images/logo.png";
import { useContext, useEffect, useState } from "react";
import { SesionContext } from "../context/SesionProvider";
import { useSnackbar } from "notistack";
import { useNavigate } from "react-router-dom";
import LoadingButton from "@mui/lab/LoadingButton";
import {
  KeyboardArrowRight,
} from "@mui/icons-material";
import { SesionInterface, UsuarioInterface } from "../interfaces/interfaces";
import { usuarioExample } from "../data/example";
import { comprobarToken, loginUsuario } from "../api/Login.api";

const LoginPage = () => {
  const { setSesion } = useContext(SesionContext);
  const [login, setLogin] = useState<UsuarioInterface>(usuarioExample);
  const [loading, setLoading] = useState(false);

  const { enqueueSnackbar } = useSnackbar();

  const navigater = useNavigate();
  useEffect(() => {
    ComprobarToken();
  }, []);




  const ComprobarToken = async () => {
    setLoading(true);
    try {

      const TokenSesion = JSON.parse(window.localStorage.getItem("token") || "").toString();
      if (TokenSesion != "") {
        // console.log("ComprobarToken");
        const responde = await comprobarToken(TokenSesion)
        if (responde.status === 200) {
          setSesion({ token: TokenSesion, usuario: responde.usuario as UsuarioInterface });
          navigater("/home", { replace: true });
        }
      }
    } catch (e) {
      console.log();
    }
    setLoading(false);
  };

  const ValidarDatos = async () => {

    if (login.user === "" || login.pass === "") {
      return enqueueSnackbar("Rellena todos los espacios", {
        variant: "warning",
      });
    } else {
      setLoading(true);
      const responde = await loginUsuario(login);
      if (responde.status != 500) {
        window.localStorage.setItem("token", JSON.stringify(responde.usuario?.token));
        setSesion(responde.usuario as SesionInterface);
        navigater("/home", { replace: true });

        enqueueSnackbar("Bienvenido", {
          variant: "success",
        });
      } else {
        enqueueSnackbar(responde.message, {
          variant: "error",
        });
        setLoading(false);
      }

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
            onChange={(e) => setLogin({ ...login, pass: e.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                ValidarDatos();
              }
            }}
          />
        </Grid>
        <Grid container>
          <LoadingButton
            variant="contained"
            fullWidth
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
