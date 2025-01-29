import {
  Button,
  Card,
  CardActions,
  CardContent,
  CircularProgress,
  Grid,
  Typography,
} from "@mui/material";
import { useContext, useEffect, useState } from "react";
import {
  eventoExample,
  latExample,
  lngExample,
  posteExample,
} from "../../data/example";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { EventoInterface, PosteInterface } from "../../interfaces/interfaces";
import { getEvento } from "../../api/Evento.api";
import { SesionContext } from "../../context/SesionProvider";
import { getPoste, searchPoste } from "../../api/Poste.api";
import { LineChart } from "@mui/x-charts";
import EditPosteDialog from "../../components/dialogs/edits/EditPosteDialog";
import EditEventoDialog from "../../components/dialogs/edits/EditEventoDialog";


interface EventoGraficDataPoint {
  day: number;
  count: number;
}

const InicioPage = () => {

  const [listPostes, setListPostes] = useState<PosteInterface[]>();
  const [listEventos, setListEventos] = useState<EventoInterface[]>();

  const [postesTotal, setPostesTotal] = useState<number>(0);
  const [eventosTotal, setEventosTotal] = useState<number>(0);
  const [eventosSolucionadosTotal, setEventosSolucionadosTotal] = useState<number>(0);

  const [postesTotalMes, setPostesTotalMes] = useState<number>(0);
  const [eventosTotalMes, setEventosTotalMes] = useState<number>(0);
  const [eventosSolucionadosTotalMes, setEventosSolucionadosTotalMes] = useState<number>(0);

  const { sesion } = useContext(SesionContext);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const [eventoGraficData, setEventoGraficData] = useState<EventoGraficDataPoint[]>();
  const [soluciónGraficData, setSoluciónGraficData] = useState<EventoGraficDataPoint[]>();

  const [dataPoste, setDataPoste] = useState<PosteInterface>(posteExample);
  const [openEditPoste, setOpenEditPoste] = useState(false);

  const [dataEvento, setDataEvento] = useState<EventoInterface>(eventoExample);
  const [openEditEvento, setOpenEditEvento] = useState(false);



  useEffect(() => {
    recibirDatos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    let totalEventos = 0;
    let totalSolucionados = 0;
    let totalPostes = 0;

    let totalEventosMes = 0;
    let totalSolucionadosMes = 0;
    let totalPostesMes = 0;
    let newEventoGraficData = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      count: 0,
    }));
    let newSoluciónGraficData = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      count: 0,
    }));

    // Año actual



    // Calcular cuántos días tiene el mes actual
    /*
      // Inicializar un array para contar los datos por día
      const aggregatedData = Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1,
        count: 0,
      }));*/






    listEventos?.map((evento) => {
      const eventoDate = new Date(evento.date);

      if (eventoDate.getMonth() === currentMonth && eventoDate.getFullYear() === currentYear) {
        const day = eventoDate.getDate();

        if (!evento.state) {
          newEventoGraficData = newEventoGraficData.map((item, i) => (i === (day - 1) ? { ...item, count: item.count += 1 } : item));

        }
        else {
          newSoluciónGraficData = newSoluciónGraficData.map((item, i) => (i === (day - 1) ? { ...item, count: item.count += 1 } : item));

        }

      }


      if (!evento.state) {

        totalEventos++;
        if (eventoDate.getMonth() === currentMonth && eventoDate.getFullYear() === currentYear) {
          totalEventosMes++;
        }
      }
      else {
        totalSolucionados++
        if (eventoDate.getMonth() === currentMonth && eventoDate.getFullYear() === currentYear) {
          totalSolucionadosMes++;
        }
      }
    },

    )
    listPostes?.map((poste) => {
      const posteDate = new Date(poste.date);

      totalPostes++;
      if (posteDate.getMonth() === currentMonth && posteDate.getFullYear() === currentYear) {
        totalPostesMes++;
      }
    },
    )
    setEventosTotal(totalEventos)
    setEventosSolucionadosTotal(totalSolucionados)
    setPostesTotal(totalPostes)

    setEventosTotalMes(totalEventosMes)
    setEventosSolucionadosTotalMes(totalSolucionadosMes)
    setPostesTotalMes(totalPostesMes)

    setEventoGraficData(newEventoGraficData)
    setSoluciónGraficData(newSoluciónGraficData)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listEventos, listPostes])

  const recibirDatos = async () => {
    setListEventos(await getEvento(sesion.token))
    setListPostes(await getPoste(sesion.token))

  }

  return (
    <Grid container alignItems={"stretch"}  >
      <Grid display={"flex"} flexDirection={"column"} item xs={6} md={4}>
        <Card style={{ display: "flex", flexDirection: "column", height: "100%" }} >

          <CardActions >
            <Typography
              sx={{ fontSize: 14 }}
              fontWeight="bold"
              color="text.secondary"
            >
              Postes Totales del mes
            </Typography>
          </CardActions>
          <CardContent style={{ display: "flex", flexDirection: "column", flex: 1 }} >
            <Grid container flexDirection={"column"} margin={0} flex={1}>
              <Typography
                variant="h4"
                fontWeight={"bold"}
                color="text.secondary"
                component="div"
              >
                {listPostes ?
                  postesTotalMes
                  : <Grid sx={{ alignItems: "center", justifyContent: "center", display: "flex", height: "100%" }}> <CircularProgress /> </Grid>}

              </Typography>
              <Typography sx={{ mb: 1.5 }} color="text.secondary" variant="subtitle2">
                Postes del mes
              </Typography>
            </Grid>
          </CardContent>

        </Card>
      </Grid>
      <Grid display={"flex"} flexDirection={"column"} item xs={6} md={4}>
        <Card style={{ display: "flex", flexDirection: "column", height: "100%" }} >

          <CardActions >
            <Typography
              sx={{ fontSize: 14 }}
              fontWeight="bold"
              color="text.secondary"
            >
              Eventos pendientes del mes
            </Typography>
          </CardActions>
          <CardContent style={{ display: "flex", flexDirection: "column", flex: 1 }} >
            <Grid container flexDirection={"column"} margin={0} flex={1}>
              <Typography
                variant="h4"
                fontWeight={"bold"}
                color="text.secondary"
                component="div"
              >
                {listEventos ?
                  eventosTotalMes
                  : <Grid sx={{ alignItems: "center", justifyContent: "center", display: "flex", height: "100%" }}> <CircularProgress /> </Grid>}
              </Typography>
              <Typography sx={{ mb: 1.5 }} color="text.secondary" variant="subtitle2">
                Eventos del mes
              </Typography>
            </Grid>
          </CardContent>

        </Card>
      </Grid>
      <Grid display={"flex"} flexDirection={"column"} item xs={12} md={4}>
        <Card style={{ display: "flex", flexDirection: "column", height: "100%" }} >

          <CardActions >
            <Typography
              sx={{ fontSize: 14 }}
              fontWeight="bold"
              color="text.secondary"
            >
              Eventos Solucionados del mes
            </Typography>
          </CardActions>
          <CardContent style={{ display: "flex", flexDirection: "column", flex: 1 }} >
            <Grid container flexDirection={"column"} margin={0} flex={1}>
              <Typography
                variant="h4"
                fontWeight={"bold"}
                color="text.secondary"
                component="div"
              >
                {listEventos ?
                  eventosSolucionadosTotalMes
                  : <Grid sx={{ alignItems: "center", justifyContent: "center", display: "flex", height: "100%" }}> <CircularProgress /> </Grid>}

              </Typography>

              <Typography sx={{ mb: 1.5 }} color="text.secondary" variant="subtitle2">
                Eventos del mes
              </Typography>
            </Grid>
          </CardContent>

        </Card>
      </Grid>

      <Grid display={"flex"} flexDirection={"column"} item xs={12} md={6}>
        <Card style={{ display: "flex", flexDirection: "column", height: "100%" }}
        >
          <CardActions >
            <Typography
              sx={{ fontSize: 14 }}
              fontWeight="bold"
              color="text.secondary"
            >
              Gráfica De Eventos Solucionados Del Mes
            </Typography>
          </CardActions>
          <CardContent style={{ display: "flex", flexDirection: "column", flex: 1 }} >
            <Grid container flexDirection={"column"} margin={0} flex={1}  >

              {soluciónGraficData ?
                <LineChart
                  xAxis={[
                    { label: "Días del mes", data: soluciónGraficData.map((point) => point.day) },
                  ]}
                  series={[
                    {
                      label: "Cantidad de eventos solucionados del mes",
                      data: soluciónGraficData.map((point) => {

                        return point.count
                      }),
                    },
                  ]}
                  height={400}

                />
                : null}
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      <Grid display={"flex"} flexDirection={"column"} item xs={12} md={6}>
        <Card style={{ display: "flex", flexDirection: "column", height: "100%" }}
        >
          <CardActions >
            <Typography
              sx={{ fontSize: 14 }}
              fontWeight="bold"
              color="text.secondary"
            >
              Gráfica De Eventos Pendientes Del Mes
            </Typography>
          </CardActions>
          <CardContent style={{ display: "flex", flexDirection: "column", flex: 1 }} >
            <Grid container flexDirection={"column"} margin={0} flex={1}  >
              {eventoGraficData ?
                <LineChart
                  xAxis={[
                    { label: "Días del mes", data: eventoGraficData.map((point) => point.day) },
                  ]}
                  series={[
                    {
                      label: "Cantidad de eventos pendientes del mes",
                      data: eventoGraficData.map((point) => {
                        return point.count
                      }),
                    },
                  ]}
                  height={400}
                />
                : null}

            </Grid>
          </CardContent>

        </Card>
      </Grid>

      <Grid item xs={12} md={6}>
        <Card  >
          <CardActions
            style={{
              justifyContent: "space-between",
            }}
          >
            <Typography
              sx={{ fontSize: 14 }}
              fontWeight="bold"
              color="text.secondary"
            >
              Eventos Pendientes Del Mes
            </Typography>

          </CardActions>
          <CardContent>
            {/* @ts-expect-error No se sabe el tipo de event */}
            <MapContainer center={[latExample, lngExample]}
              zoom={5}
              style={{ height: "500px" }}
              scrollWheelZoom={false}

            >
              <TileLayer url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png" />
              {
                listEventos?.map((item, i) => {
                  const now = new Date();
                  const eventoDate = new Date(item.date);
                  if (!item.state) {
                    if (eventoDate.getMonth() === now.getMonth() && eventoDate.getFullYear() === now.getFullYear()) {
                      return <Marker key={i} position={[item.poste?.lat, item.poste?.lng]}>
                        <Popup>
                          <Grid sx={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", gap: "8px" }}>

                            Poste {item.poste?.name}
                            <Button onClick={() => {
                              if (item.id) {
                                setOpenEditEvento(true);
                                setDataEvento(item)
                              }
                            }}>Editar Evento</Button>
                          </Grid>

                        </Popup>
                      </Marker>
                    } else { return }

                  }
                  else { return }
                }
                )
              }
            </MapContainer>
          </CardContent>

        </Card>
      </Grid>
      <Grid item xs={12} md={6}>
        <Card  >
          <CardActions
            style={{
              justifyContent: "space-between",
            }}
          >
            <Typography
              sx={{ fontSize: 14 }}
              fontWeight="bold"
              color="text.secondary"
            >
              Eventos Solucionados Del Mes
            </Typography>

          </CardActions>
          <CardContent>
            {/* @ts-expect-error No se sabe el tipo de event */}
            <MapContainer center={[latExample, lngExample]}
              zoom={5}
              style={{ height: "500px" }}
              scrollWheelZoom={false}

            >
              <TileLayer url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png" />
              {
                listEventos?.map((item, i) => {
                  const now = new Date();
                  const eventoDate = new Date(item.date);
                  if (item.state) {
                    if (eventoDate.getMonth() === now.getMonth() && eventoDate.getFullYear() === now.getFullYear()) {
                      return <Marker key={i} position={[item.poste?.lat, item.poste?.lng]}>
                        <Popup>
                          <Grid sx={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", gap: "8px" }}>
                            Poste {item.poste?.name}
                            <Button onClick={() => {
                              if (item.id) {
                                setOpenEditEvento(true);
                                setDataEvento(item)
                              }
                            }}>Editar Evento</Button>
                          </Grid>
                        </Popup>
                      </Marker>
                    } else { return }

                  }
                  else { return }
                }
                )
              }
            </MapContainer>
          </CardContent>

        </Card>
      </Grid>







      <Grid display={"flex"} flexDirection={"column"} item xs={6} md={4}>
        <Card style={{ display: "flex", flexDirection: "column", height: "100%" }} >

          <CardActions >
            <Typography
              sx={{ fontSize: 14 }}
              fontWeight="bold"
              color="text.secondary"
            >
              Postes Totales
            </Typography>
          </CardActions>
          <CardContent style={{ display: "flex", flexDirection: "column", flex: 1 }} >
            <Grid container flexDirection={"column"} margin={0} flex={1}>
              <Typography
                variant="h4"
                fontWeight={"bold"}
                color="text.secondary"
                component="div"
              >
                {listPostes ?
                  postesTotal
                  : <Grid sx={{ alignItems: "center", justifyContent: "center", display: "flex", height: "100%" }}> <CircularProgress /> </Grid>}

              </Typography>
              <Typography sx={{ mb: 1.5 }} color="text.secondary" variant="subtitle2">
                Postes
              </Typography>
            </Grid>
          </CardContent>

        </Card>
      </Grid>
      <Grid display={"flex"} flexDirection={"column"} item xs={6} md={4}>
        <Card style={{ display: "flex", flexDirection: "column", height: "100%" }} >

          <CardActions >
            <Typography
              sx={{ fontSize: 14 }}
              fontWeight="bold"
              color="text.secondary"
            >
              Eventos pendientes
            </Typography>
          </CardActions>
          <CardContent style={{ display: "flex", flexDirection: "column", flex: 1 }} >
            <Grid container flexDirection={"column"} margin={0} flex={1}>
              <Typography
                variant="h4"
                fontWeight={"bold"}
                color="text.secondary"
                component="div"
              >
                {listEventos ?
                  eventosTotal
                  : <Grid sx={{ alignItems: "center", justifyContent: "center", display: "flex", height: "100%" }}> <CircularProgress /> </Grid>}
              </Typography>
              <Typography sx={{ mb: 1.5 }} color="text.secondary" variant="subtitle2">
                Eventos
              </Typography>
            </Grid>
          </CardContent>

        </Card>
      </Grid>
      <Grid display={"flex"} flexDirection={"column"} item xs={12} md={4} >
        <Card style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%" }} >

          <CardActions >
            <Typography
              sx={{ fontSize: 14 }}
              fontWeight="bold"
              color="text.secondary"
            >
              Eventos Solucionados
            </Typography>
          </CardActions>
          <CardContent style={{ display: "flex", flexDirection: "column", flex: 1 }} >
            <Grid container flexDirection={"column"} margin={0} flex={1}>
              <Typography
                variant="h4"
                fontWeight={"bold"}
                color="text.secondary"
                component="div"
              >
                {listEventos ?
                  eventosSolucionadosTotal
                  : <Grid sx={{ alignItems: "center", justifyContent: "center", display: "flex", height: "100%" }}> <CircularProgress /> </Grid>}

              </Typography>

              <Typography sx={{ mb: 1.5 }} color="text.secondary" variant="subtitle2">
                Eventos
              </Typography>
            </Grid>
          </CardContent>

        </Card>
      </Grid>



















      <Grid item xs={12} md={6}>
        <Card  >
          <CardActions
            style={{
              justifyContent: "space-between",
            }}
          >
            <Typography
              sx={{ fontSize: 14 }}
              fontWeight="bold"
              color="text.secondary"
            >
              Eventos Pendientes En El Mapa
            </Typography>

          </CardActions>
          <CardContent>
            {/* @ts-expect-error No se sabe el tipo de event */}
            <MapContainer center={[latExample, lngExample]}
              zoom={5}
              style={{ height: "500px" }}
              scrollWheelZoom={false}

            >
              <TileLayer url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png" />
              {
                listEventos?.map((item, i) => {
                  if (!item.state) {
                    return <Marker key={i} position={[item.poste?.lat, item.poste?.lng]}>
                      <Popup>
                        <Grid sx={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", gap: "8px" }}>

                          Poste {item.poste?.name}
                          <Button onClick={() => {
                            if (item.id) {
                              setOpenEditEvento(true);
                              setDataEvento(item)
                            }
                          }}>Editar Evento</Button>
                        </Grid>

                      </Popup>
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
      <Grid item xs={12} md={6}>
        <Card  >
          <CardActions
            style={{
              justifyContent: "space-between",
            }}
          >
            <Typography
              sx={{ fontSize: 14 }}
              fontWeight="bold"
              color="text.secondary"
            >
              Postes En El Mapa
            </Typography>

          </CardActions>
          <CardContent>
            {/* @ts-expect-error No se sabe el tipo de event */}
            <MapContainer center={[latExample, lngExample]}
              zoom={5}
              style={{ height: "500px" }}
              scrollWheelZoom={false}

            >
              <TileLayer url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png" />
              {
                listPostes?.map((item, i) => {
                  return <Marker key={i} position={[item?.lat, item?.lng]} >
                    <Popup >
                      <Grid sx={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column", gap: "8px" }}>
                        Poste {item.name}
                        <Button onClick={async () => {
                          if (item.id) {
                            setOpenEditPoste(true);
                            setDataPoste(await searchPoste(item.id, sesion.token))
                          }

                        }}>Editar Poste</Button>
                      </Grid>

                    </Popup>
                  </Marker>
                }
                )
              }
            </MapContainer>
          </CardContent>

        </Card>
      </Grid>
      {dataPoste.id != null ? <EditPosteDialog functionApp={recibirDatos} poste={dataPoste} setPoste={setDataPoste} open={openEditPoste} setOpen={setOpenEditPoste} /> : null}
      {dataEvento.id != null ? <EditEventoDialog functionApp={recibirDatos} Evento={dataEvento} setEvento={setDataEvento} open={openEditEvento} setOpen={setOpenEditEvento} /> : null}

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