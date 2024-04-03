import {
  Card,
  CardActions,
  CardContent,
  Grid,
  Typography,
} from "@mui/material";
import { useContext, useEffect, useState } from "react";
import {
  latExample,
  lngExample,
} from "../../data/example";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { EventoInterface, PosteInterface } from "../../interfaces/interfaces";
import { getEvento } from "../../api/Evento.api";
import { SesionContext } from "../../context/SesionProvider";
import { getPoste } from "../../api/Poste.api";


const InicioPage = () => {

  const [listPostes, setListPostes] = useState<PosteInterface[]>();
  const [listEventos, setListEventos] = useState<EventoInterface[]>();

  const [postesTotal, setPostesTotal] = useState<number>(0);
  const [eventosTotal, setEventosTotal] = useState<number>(0);
  const [eventosSolucionadosTotal, setEventosSolucionadosTotal] = useState<number>(0);

  const { sesion } = useContext(SesionContext);


  useEffect(() => {
    recibirDatos()
  }, [])
  useEffect(() => {
    let totalEventos = 0;
    let totalSolucionados = 0;
    let totalPostes = 0;

    listEventos?.map((evento) => {
      if (!evento.state) {
        totalEventos++;
      }
      else {
        totalSolucionados++
      }
    },
    )
    listPostes?.map(() => {
      totalPostes++;
    },
    )
    setEventosTotal(totalEventos)
    setEventosSolucionadosTotal(totalSolucionados)
    setPostesTotal(totalPostes)

  }, [listEventos, listPostes])

  const recibirDatos = async () => {
    setListEventos(await getEvento(sesion.token))
    setListPostes(await getPoste(sesion.token))

  }

  return (
    <Grid container alignItems={"stretch"}  >

      <Grid display={"flex"} flexDirection={"column"} item xs={12} md={4}>
        <Card style={{ display: "flex", flexDirection: "column" }} >
          <CardActions >
            <Typography
              sx={{ fontSize: 16 }}
              fontWeight="bold"
              color="text.secondary"
            >
              Postes Totales
            </Typography>
          </CardActions>
          <CardContent style={{ display: "flex", flexDirection: "column", flex: 1 }} >
            <Grid container flexDirection={"column"} margin={0} flex={1}>
              <Typography
                variant="h1"
                fontWeight={"bold"}
                color="text.secondary"
                component="div"
              >
                {postesTotal}
              </Typography>
              <Typography sx={{ mb: 1.5 }} color="text.secondary">
                Postes
              </Typography>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
      <Grid display={"flex"} flexDirection={"column"} item xs={12} md={4}>
        <Card style={{ display: "flex", flexDirection: "column" }} >
          <CardActions >
            <Typography
              sx={{ fontSize: 16 }}
              fontWeight="bold"
              color="text.secondary"
            >
              Eventos pendientes
            </Typography>
          </CardActions>
          <CardContent style={{ display: "flex", flexDirection: "column", flex: 1 }} >
            <Grid container flexDirection={"column"} margin={0} flex={1}>
              <Typography
                variant="h1"
                fontWeight={"bold"}
                color="text.secondary"
                component="div"
              >
                {eventosTotal}
              </Typography>
              <Typography sx={{ mb: 1.5 }} color="text.secondary">
                Eventos
              </Typography>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
      <Grid display={"flex"} flexDirection={"column"} item xs={12} md={4}>
        <Card style={{ display: "flex", flexDirection: "column" }} >
          <CardActions >
            <Typography
              sx={{ fontSize: 16 }}
              fontWeight="bold"
              color="text.secondary"
            >
              Eventos Solucionados
            </Typography>
          </CardActions>
          <CardContent style={{ display: "flex", flexDirection: "column", flex: 1 }} >
            <Grid container flexDirection={"column"} margin={0} flex={1}>
              <Typography
                variant="h1"
                fontWeight={"bold"}
                color="text.secondary"
                component="div"
              >
                {eventosSolucionadosTotal}
              </Typography>
              <Typography sx={{ mb: 1.5 }} color="text.secondary">
                Eventos
              </Typography>
            </Grid>
          </CardContent>
        </Card>
      </Grid>


      <Grid item xs={12}>
        <Card  >
          <CardActions
            style={{
              justifyContent: "space-between",
            }}
          >
            <Typography
              sx={{ fontSize: 16 }}
              fontWeight="bold"
              color="text.secondary"
            >
              Eventos Pendientes En El Mapa
            </Typography>

          </CardActions>
          <CardContent>
            {/* @ts-expect-error No se sabe el tipo de event */}
            <MapContainer center={[latExample, lngExample]}
              zoom={6}
              style={{ height: "500px" }}
              scrollWheelZoom={false}

            >
              <TileLayer url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png" />
              {
                listEventos?.map((item, i) => {
                  if (!item.state) {
                    return <Marker key={i} position={[item.poste?.lat, item.poste?.lng]}>
                      <Popup>You are here</Popup>
                    </Marker>
                  }
                  else { return }
                }
                )
              }
            </MapContainer>
          </CardContent>

        </Card>
      </Grid>
      <Grid item xs={12}>
        <Card  >
          <CardActions
            style={{
              justifyContent: "space-between",
            }}
          >
            <Typography
              sx={{ fontSize: 16 }}
              fontWeight="bold"
              color="text.secondary"
            >
              Postes En El Mapa
            </Typography>

          </CardActions>
          <CardContent>
            {/* @ts-expect-error No se sabe el tipo de event */}
            <MapContainer center={[latExample, lngExample]}
              zoom={6}
              style={{ height: "500px" }}
              scrollWheelZoom={false}

            >
              <TileLayer url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png" />
              {
                listPostes?.map((item, i) => {

                  return <Marker key={i} position={[item?.lat, item?.lng]}>
                    <Popup>You are here</Popup>
                  </Marker>
                }
                )
              }
            </MapContainer>
          </CardContent>

        </Card>
      </Grid>
    </Grid>
  );
};

export default InicioPage;


/*
<Grid item xs={12} md={8}>
        <Card >
          {" "}
          <CardContent>
            <Typography
              sx={{ fontSize: 14 }}
              color="text.secondary"
              gutterBottom
            >
              Histórico
            </Typography>
            <hr />
            <LineChart
              height={300}
              series={[
                { data: pData, label: "pv", id: "pvId" },
                { data: uData, label: "uv", id: "uvId" },
              ]}
              xAxis={[
                {
                  scaleType: "time",
                  data: timeData,
                  min: timeData[0].getTime(),
                  max: timeData[timeData.length - 1].getTime(),
                },
              ]}
              sx={{
                ".MuiLineElement-root, .MuiMarkElement-root": {
                  strokeWidth: 1,
                },
                ".MuiLineElement-series-pvId": {
                  strokeDasharray: "5 5",
                },
                ".MuiLineElement-series-uvId": {
                  strokeDasharray: "3 4 5 2",
                },
                ".MuiMarkElement-root:not(.MuiMarkElement-highlighted)": {
                  fill: "#fff",
                },
                "& .MuiMarkElement-highlighted": {
                  stroke: "none",
                },
              }}
            />
          </CardContent>
        </Card>
      </Grid>
*/