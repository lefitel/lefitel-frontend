import {
  Card,
  Grid,
  Typography,
} from "@mui/material";
import { UsuarioInterface } from "../../../../interfaces/interfaces";
import { url } from "../../../../api/url";

interface SeguridadDetalleDataSecProps {
  data: UsuarioInterface;
}
const SeguridadDetalleDataSec: React.FC<SeguridadDetalleDataSecProps> = ({ data }) => {
  return (
    <Card
      sx={{
        height: { xs: "auto", md: "calc(100vh - 205px)" },
      }}
    >
      <Grid color="text.secondary" container alignItems={"start"}>
        <Grid
          item
          container
          xs={12}
          md={8}
        >
          <Grid item xs={12} md={6} textAlign={"left"} lineHeight={1} >
            <Typography variant="h6">User: <b>{data.user}</b></Typography>
          </Grid>
          <Grid item xs={12} md={6} textAlign={"left"} lineHeight={1} >
            <Typography variant="h6" >Rol: <b>{data.id_rol}</b></Typography>
          </Grid>
          <Grid item xs={12} md={6} textAlign={"left"} lineHeight={1} flex={1}>
            <Typography variant="h6">Nombre: <b>{data.name}</b></Typography>
          </Grid>
          <Grid item xs={12} md={6} textAlign={"left"} lineHeight={1} >
            <Typography variant="h6">Apellido:  <b>{data.lastname}</b></Typography>
          </Grid>
          <Grid item xs={12} md={6} textAlign={"left"} lineHeight={1} flex={1}>
            <Typography variant="h6">Telefono: <b>{data.phone}</b></Typography>
          </Grid>


          <Grid item xs={12} md={6} textAlign={"left"} lineHeight={1}>
            <Typography variant="h6">Fecha de nacimiento: <b>{data.birthday}</b></Typography>
          </Grid>
        </Grid>

        <Grid
          item
          display={"flex"}
          alignItems={"center"}
          gap={1}
          xs={12}
          md={4}
        >
          <Grid
            display={"flex"}
            alignItems={"center"}
            justifyContent={"center"}
          >
            <img
              width={"100%"}
              style={{
                aspectRatio: "1/1",
                objectFit: "cover",
                borderRadius: 4,
              }}
              src={`${url}${data.image}`}
              alt={"imagen"}
              loading="lazy"
            />
          </Grid>


        </Grid>
      </Grid>
    </Card>
  );
};

export default SeguridadDetalleDataSec;
