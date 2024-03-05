import "leaflet/dist/leaflet.css";
import {
  Grid,
} from "@mui/material";
import AdssSec from "./parametros/AdssSec";
import MaterialSec from "./parametros/MaterialSec";
import ObsSec from "./parametros/ObsSec";
import PropietarioSec from "./parametros/PropiedadSec";
import TipoObsSec from "./parametros/TipoObsSec";
import CiudadSec from "./parametros/CiudadSec";

const ParametrosPage = () => {
  return (
    <Grid
      container
      sx={{
        alignItems: "stretch",
        margin: 0,
      }}
    >
      <Grid display={"flex"} flexDirection={"column"} item xs={12} md={8}>
        <AdssSec />
      </Grid>


      <Grid display={"flex"} flexDirection={"column"} item xs={12} md={4}>
        <PropietarioSec />
      </Grid>
      <Grid display={"flex"} flexDirection={"column"} item xs={12} md={4}>
        <TipoObsSec />
      </Grid>
      <Grid display={"flex"} flexDirection={"column"} item xs={12} md={8}>
        <ObsSec />
      </Grid>
      <Grid display={"flex"} flexDirection={"column"} item xs={12} md={8}>
        <CiudadSec />
      </Grid>
      <Grid display={"flex"} flexDirection={"column"} item xs={12} md={4}>
        <MaterialSec />
      </Grid>
    </Grid>
  );
};

export default ParametrosPage;

/*
<Grid display={"flex"} flexDirection={"column"} item xs={12} md={6}>
        <ObsSec />
      </Grid>
      <Grid display={"flex"} flexDirection={"column"} item xs={12} md={6}>
        <PropiedadSec />
      </Grid>
*/
