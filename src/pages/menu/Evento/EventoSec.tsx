import PropTypes from "prop-types";
import {
  Card,
  Checkbox,
  FormControlLabel,
  Grid,
  TextField,
  Typography,
} from "@mui/material";
import { CellTower } from "@mui/icons-material";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { useEffect, useState } from "react";
import { AdssPosteInterface, PosteInterface } from "../../../interfaces/interfaces";

interface PosteDetalleDataSecProps {
  listAdssPoste: AdssPosteInterface[] | undefined;

}

const PosteDetalleDataSec: React.FC<PosteDetalleDataSecProps> = ({listAdssPoste }) => {
  const [listAdss, setListAdss] = useState<AdssInterface[]>();

  useEffect(() => {
    //console.log("data")
    //console.log(listAdssPoste)
    //console.log("data")
    recibirDatos()
  }, [])


  const recibirDatos = async () => {
    setListAdss(await getAdss())
    //setList(await getEve(posteId))
  }

  return (
    <Card
      sx={{
        height: { xs: "auto", md: "calc(100vh - 205px)" },
      }}
    >
      <Grid color="text.secondary" container alignItems={"start"}>
        <Grid container item xs={12} md={8}>
          <Grid item xs={12} md={6} textAlign={"left"} lineHeight={1}>
            <Typography>Numero: <b>{data.name}</b></Typography>
          </Grid>
          <Grid item xs={12} md={6} textAlign={"left"} lineHeight={1}>
            <Typography>Propietario: <b>{data.id_propietario}</b></Typography>
          </Grid>
          <Grid item xs={12} md={6} textAlign={"left"} lineHeight={1}>
            <Typography>Material: <b>{data.id_material}</b></Typography>
          </Grid>
          <Grid item xs={12} md={6} textAlign={"left"} lineHeight={1}>
            <Typography>Tramo: <b>{data.id_ciudadA} - {data.id_ciudadB}</b></Typography>
          </Grid>
          <Grid item xs={12} textAlign={"left"} lineHeight={1}>
            <Typography>Ferreteria de sujeción:</Typography>
            <Grid container m={0} p={0} justifyContent={"left"}>

              {listAdss ? listAdss.map((adss, i) => (
                <Grid key={i} item xs={12} md={6} p={0} m={0}>
                  <FormControlLabel
                    control={<Checkbox checked={listAdssPoste?.some(objeto => objeto.id_adss === adss.id)} sx={{ p: "5px" }} disabled />}
                    sx={{
                      margin: 0,
                      p: 0,
                    }}
                    label={adss.name}
                  />
                </Grid>
              )) : null}
            </Grid>
          </Grid>
          <Grid
            item
            sx={{
              height: "100%",
            }}
            xs={12}
            md={12}
            paddingBlock={1}
            paddingInline={0}
          >
            <Grid container m={0} p={0}>
              <Grid item xs={12} textAlign={"left"}>
                <Typography>Ubicación:</Typography>
                <Grid display={"flex"}>
                  <Typography fontWeight={"bold"}>
                    Lat: {data.lat}{" "}
                  </Typography>
                  <Typography fontWeight={"bold"} paddingInline={1}>
                    -
                  </Typography>
                  <Typography fontWeight={"bold"}>
                    {" "}
                    Lng: {data.lng}
                  </Typography>
                </Grid>
              </Grid>
            </Grid>
            <Grid item xs={12}>
              <MapContainer
                center={[data.lat, data.lng]}
                zoom={13}
                style={{ height: "calc(100vh - 480px)" }}
                scrollWheelZoom={false}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png" />
                <Marker position={[data.lat, data.lng]}>
                  <Popup>
                    <Grid container flexDirection={"column"} gap={1}>
                      Poste
                    </Grid>
                  </Popup>
                </Marker>
              </MapContainer>
            </Grid>
          </Grid>
        </Grid>

        <Grid
          item
          sx={
            {
              //maxHeight: "calc(100vh - 300px)",
            }
          }
          xs={12}
          md={4}
          paddingBlock={1}
          overflow={"hidden"}
        >
          <Grid display={"flex"} justifyContent={"space-between"}>
            <Typography>Imagen:</Typography>
          </Grid>

          <img
            style={{
              objectFit: "cover",
              borderRadius: 4,
              width: "100%",
              height: "calc(100vh - 270px)",
            }}
            src={`${url}${data.image}`}
            alt={"imagen"}
            loading="lazy"
          />
        </Grid>
      </Grid>
      
    </Card>
  );
};
export default PosteDetalleDataSec;
