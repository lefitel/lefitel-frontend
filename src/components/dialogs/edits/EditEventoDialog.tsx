import { ArrowDropDown } from "@mui/icons-material";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  Input,
  TextField,
  Typography,
} from "@mui/material";
import React, { useContext, useEffect, useState } from "react";
import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import { DateTimePicker } from "@mui/x-date-pickers";
import { useSnackbar } from "notistack";
import { EventoInterface, RevicionInterface, TipoObsInterface, ObsInterface, EventoObsInterface, SolucionInterface } from "../../../interfaces/interfaces";
import { url } from "../../../api/url";
import dayjs from "dayjs";
import { uploadImage } from "../../../api/Upload.api";
import { deleteEvento, editEvento } from "../../../api/Evento.api";
import { eventoExample, revicionExample, solucionExample } from "../../../data/example";
import { getObs } from "../../../api/Obs.api";
import { getTipoObs } from "../../../api/TipoObs.api";
import { createEventoObs, deleteEventoObs, getEventoObs } from "../../../api/EventoObs.api";
import { getSolucion_evento } from "../../../api/Solucion.api";
import { createRevicion, editRevicion, getRevicion } from "../../../api/Revicion.api";
import AddSolucionDialog from "../add/AddSolucionDialog";
import { SesionContext } from "../../../context/SesionProvider";


interface EditEventoDialogProps {
  Evento: EventoInterface;
  setEvento: (Evento: EventoInterface) => void;

  functionApp: () => void;
  setOpen: (open: boolean) => void;
  open: boolean;
}
const EditEventoDialog: React.FC<EditEventoDialogProps> = ({ Evento, setEvento, functionApp, setOpen, open }) => {
  const [cargando, setCargando] = useState(false);

  const [data, setData] = useState(Evento);
  const [image, setImage] = useState<File | null>();

  const [listDataRevicion, setListDataRevicion] = React.useState<RevicionInterface[]>([]);
  const [solucion, setSolucion] = React.useState<SolucionInterface>({ ...solucionExample, id: 0 });

  const [listObsSelected, setListObsSelected] = React.useState<number[]>([]);
  const [listEventoObs, setListEventoObs] = React.useState<EventoObsInterface[]>([]);

  const { enqueueSnackbar } = useSnackbar();

  const [listObs, setListObs] = React.useState<ObsInterface[]>([]);
  const [listTipoObs, setListTipoObs] = React.useState<TipoObsInterface[]>([]);

  const [openDelete, setOpenDelete] = useState(false);
  const { sesion } = useContext(SesionContext);

  useEffect(() => {
    recibirDatos()
  }, [open])

  const recibirDatos = async () => {
    setCargando(true)

    const eventoObsTemp = await getEventoObs(data.id as number, sesion.token)
    await setListEventoObs(eventoObsTemp)
    const ids = await eventoObsTemp.map(objeto => objeto.id) ? eventoObsTemp.map(objeto => objeto.id_obs) : [];
    setListObsSelected(ids as [])
    setSolucion(await getSolucion_evento(data.id as number, sesion.token))
    setListDataRevicion(await getRevicion(data.id as number, sesion.token))
    setListObs(await getObs(sesion.token))
    setListTipoObs(await getTipoObs(sesion.token))
    await setCargando(false)

  }


  const handleClose = () => {
    setOpen(false);
    setEvento(eventoExample)
    setSolucion({ ...solucionExample, id: 0 })
    functionApp();
    setListObsSelected([]);
  };
  const handleClickOpenDelete = () => {
    setCargando(true)
  };

  const handleCloseDelete = () => {
    setOpenDelete(false);
  };

  /* @ts-expect-error No se sabe el tipo de event */
  const onImageChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      setImage(event.target.files[0]);
    }
  };


  const handleEdit = async () => {
    setCargando(true)
    if (data.description != '' && data.id_poste != 0 && listObsSelected.length > 0) {
      let newData: EventoInterface = { ...data }
      if (image) {
        const reponseUpload = await uploadImage(image, sesion.token);
        if (reponseUpload != "500") {
          newData = { ...newData, image: reponseUpload, date: listDataRevicion[0].date };
        }
        else {
          enqueueSnackbar("No se pudo Ingresar la imagen", {
            variant: "error",
          });
        }
      }
      const reponse = await editEvento(newData, sesion.token);
      if (Number(reponse.status) === 200) {
        try {
          const diferenciasAñadir = listObsSelected.filter(numero => listEventoObs.every(objeto => objeto.id_obs !== numero));
          const diferenciasEliminar = listEventoObs.filter(objeto => listObsSelected.every(numero => objeto.id_obs !== numero))
            .map(objeto => objeto.id);
          diferenciasAñadir.map(async (obs: number) => {
            await createEventoObs({ id_obs: obs, id_evento: reponse.data.id as number }, sesion.token);
          })
          diferenciasEliminar.map(async (obs) => {
            await deleteEventoObs(obs as number, sesion.token);
          }
          )
          listDataRevicion.map(async (revicion: RevicionInterface) => {
            if (revicion.id) {
              await editRevicion(revicion, sesion.token)
            } else {
              await createRevicion(revicion, sesion.token)
            }
          })
          await setCargando(false)
          await enqueueSnackbar("Ingresado con exito", {
            variant: "success",
          })


          handleClose()
        } catch (e) {
          setCargando(false)
          enqueueSnackbar("Error al ingresar los Adss", {
            variant: "error",
          })
        }
      }
      else {
        setCargando(false)
        enqueueSnackbar("No se pudo Ingresar", {
          variant: "error",
        });
      }

    }
    else {
      setCargando(false)
      enqueueSnackbar("Rellena todos los espacios", {
        variant: "warning",
      });
    }
  }

  const handleDelete = async () => {
    setCargando(true)
    const solucionEvento = await getSolucion_evento(data?.id as number, sesion.token);
    //console.log(solucionEvento)
    if (!solucionEvento) {
      listEventoObs.map((eventoObs) => {
        deleteEventoObs(eventoObs?.id as number, sesion.token);
      })
      const reponse = await deleteEvento(data?.id as number, sesion.token);
      if (Number(reponse) === 200) {
        setCargando(false)
        enqueueSnackbar("Eliminado con exito", {
          variant: "success",
        });
        handleCloseDelete()
        handleClose()
      }
      else {
        setCargando(false)
        enqueueSnackbar("No se pudo Eliminar", {
          variant: "error",
        });
      }
    }
    else {
      enqueueSnackbar("No se pudo Eliminar porque tiene muchos registros asociados asociados", {
        variant: "error",
      });
    }
  }

  return (
    <>
      {sesion.usuario.id_rol != 3 ? <>
        <Dialog
          fullWidth
          open={open}
          onClose={handleClose}
        >
          <DialogTitle>{"Edita los datos del Evento"}</DialogTitle>
          <DialogContent>
            <Grid container width={1} m={0}>
              <Grid item xs={12} md={2}>
                <TextField
                  disabled
                  fullWidth
                  style={{
                    padding: 0,
                    margin: 0,
                  }}
                  type="number"
                  label="Id"
                  value={data.id}

                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField

                  fullWidth
                  style={{
                    padding: 0,
                    margin: 0,
                  }}
                  label="Numero de poste"
                  value={data.id_poste}
                  disabled
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  multiline
                  style={{
                    padding: 0,
                    margin: 0,
                  }}
                  label="Descripción"
                  value={data.description}
                  onChange={(event) => {
                    const newData: EventoInterface = { ...data, description: event.target.value };
                    setData(newData)
                  }}
                />
              </Grid>
              <Grid
                item
                sx={{ p: 0 }}
                xs={12}
                md={6}

              >
                <Grid container sx={{ p: 0 }}>
                  <Grid item xs={12} sx={{ p: 0 }}>
                    <Typography
                      display={"flex"}
                      color="text.secondary"
                      textAlign={"left"}
                      paddingInline={1}
                      pb={0}
                    >
                      Observaciones:
                    </Typography>
                  </Grid>
                  {
                    listTipoObs.map((tipoObs, i) =>
                    (
                      <Grid key={i} item xs={12}>
                        <Accordion sx={{ width: 1 }} >
                          <AccordionSummary expandIcon={<ArrowDropDown />}>
                            <Typography>{tipoObs.name}</Typography>
                          </AccordionSummary>
                          <AccordionDetails
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              textAlign: "left",
                              padding: "4px",
                              margin: "0px",
                            }}
                          >
                            {listObs.map(
                              (obs, i) => {
                                if (obs.id_tipoObs === tipoObs.id) {
                                  return <Grid key={i} item xs={6} p={0}>
                                    <FormControlLabel
                                      control={<Checkbox

                                        checked={listObsSelected?.some(objeto => objeto === obs.id)}

                                        onChange={(event) => {

                                          if (event.target.checked) {
                                            setListObsSelected(prevLista => [...prevLista, obs.id ? obs.id : 0])
                                          }
                                          else {
                                            const nuevaLista = listObsSelected.filter(item => item !== obs.id);
                                            setListObsSelected(nuevaLista);
                                          }
                                        }}
                                      />}
                                      sx={{
                                        margin: 0,
                                      }}
                                      label={obs.name}

                                    />
                                  </Grid>
                                }
                                else {
                                  return null
                                }
                              }


                            )}

                          </AccordionDetails>
                        </Accordion></Grid>)
                    )
                  }
                </Grid>
              </Grid>
              <Grid
                item
                xs={12}
                md={6}
              >
                <Typography
                  display={"flex"}
                  color="text.secondary"
                  paddingInline={1}
                  textAlign={"left"}
                >
                  Imagen:
                </Typography>
                <Input fullWidth onChange={onImageChange} type={"file"} />

                {image ? <img
                  width={"100%"}
                  style={{
                    aspectRatio: "1/1",
                    objectFit: "cover",
                    borderRadius: 4,
                  }}
                  src={URL.createObjectURL(image)}
                  alt={"imagen"}
                  loading="lazy"
                /> :
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
                }
              </Grid>
              <Grid container sx={{ p: 0 }} >
                <Grid item xs={12}>
                  <Divider />
                </Grid>
              </Grid>
              <Grid item xs={12} sx={{ p: 0 }}>
                <Typography
                  display={"flex"}
                  color="text.secondary"
                  paddingInline={1}
                  textAlign={"left"}
                >
                  Reviciones:
                </Typography>
              </Grid>
              {listDataRevicion.map((revicion, i) => {
                return <Grid sx={{ p: 0, m: 0 }} key={i} container>< Grid item xs={12} md={6}>
                  <DemoContainer sx={{ p: 0 }} components={["DatePicker"]}>
                    <DateTimePicker
                      sx={{ width: 1 }}
                      label="Fecha de revición"
                      format="DD-MM-YYYY"
                      defaultValue={dayjs(revicion.date)}
                      onChange={(date) => {
                        if (date) {
                          const listaActualizada = listDataRevicion.map((item: RevicionInterface) =>
                            item.id === revicion.id ? { ...item, date: date.toDate() } : item
                          );
                          setListDataRevicion(listaActualizada);
                        }
                      }}
                    />
                  </DemoContainer>
                </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      multiline
                      style={{
                        padding: 0,
                        margin: 0,
                      }}
                      label="Descripción de revición"
                      value={revicion.description}
                      onChange={(event) => {
                        const listaActualizada = listDataRevicion.map((item: RevicionInterface) =>
                          item.id === revicion.id ? { ...item, description: event.target.value } : item
                        );
                        setListDataRevicion(listaActualizada);
                      }}
                    />
                  </Grid></Grid>
              })
              }
              <Grid container sx={{ padding: 0 }} >
                <Grid item xs={12}>
                  <Divider />
                </Grid>
              </Grid>


              {
                solucion ? <>

                  <Grid item xs={12}>
                    Solución:
                  </Grid>
                  <Grid
                    item
                    sx={{
                      height: "100%",
                    }}
                    xs={12}
                    md={6}
                    paddingBlock={1}
                    paddingInline={0}
                  >

                    <Grid item xs={12}>
                      <TextField
                        disabled
                        fullWidth
                        style={{
                          padding: 0,
                          margin: 0,
                        }}
                        type="number"
                        label="Numero de evento"
                        value={solucion.id}
                      />
                    </Grid>

                    <Grid item xs={12}>
                      <TextField
                        disabled
                        fullWidth
                        multiline
                        style={{
                          padding: 0,
                          margin: 0,
                        }}
                        label="Descripción"
                        value={solucion.description}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <DemoContainer sx={{ p: 0 }} components={["DatePicker"]}>
                        <DateTimePicker
                          disabled
                          sx={{ width: 1 }}

                          label="Fecha de solucion"
                          format="DD-MM-YYYY"
                          defaultValue={dayjs(solucion.date)}
                        />
                      </DemoContainer>
                    </Grid>
                  </Grid>

                  <Grid
                    item
                    sx={{
                      height: "100%",
                    }}
                    xs={12}
                    md={6}
                    paddingBlock={1}
                  >
                    <Grid display={"flex"} justifyContent={"space-between"}>
                      <Typography
                        display={"flex"}
                        color="text.secondary"
                        paddingInline={1}
                        textAlign={"left"}
                      >
                        Imagen:
                      </Typography>
                    </Grid>
                    <img
                      width={"100%"}
                      style={{
                        aspectRatio: "1/1",
                        objectFit: "cover",
                        borderRadius: 4,
                      }}
                      src={`${url}${solucion.image}`}
                      alt={"imagen"}
                      loading="lazy"
                    />
                  </Grid></>
                  : null
              }
            </Grid>
          </DialogContent>
          <DialogActions style={{
            display: "flex",
            justifyContent: "space-between"
          }}>
            <Grid>
              <Button onClick={handleClickOpenDelete}>
                {"Eliminar"}
              </Button>
            </Grid>
            <ButtonGroup>
              <Button onClick={handleClose}>Cancelar</Button>
              {solucion ? null : <><AddSolucionDialog functionApp={recibirDatos} evento={data} handleCloseDialog={handleClose} />
                <Button onClick={() => {
                  setListDataRevicion([...listDataRevicion, { ...revicionExample, id_evento: data?.id as number }])
                }}>Añadir revición</Button></>
              }
              <Button onClick={handleEdit}>Editar</Button>
            </ButtonGroup>

          </DialogActions>
          {sesion.usuario.id_rol === 1 ? <>
            <Dialog
              open={openDelete}
              onClose={handleCloseDelete}

            >
              <DialogTitle>{"Eliminar Evento"}</DialogTitle>
              <DialogContent>
                <Grid container width={1} m={0}>
                  Seguro que quiere eliminar este Evento?
                </Grid>
              </DialogContent>
              <DialogActions>

                <Button onClick={handleCloseDelete}>Cancelar</Button>
                <Button onClick={handleDelete}>Eliminar</Button>
              </DialogActions>

            </Dialog>
          </> : null}

        </Dialog>
        {cargando && (
          <Box sx={{ height: "100vh", width: "100vw", top: 0, left: 0, alignContent: "center", textAlign: "center", backgroundColor: 'rgba(0, 0, 0, 0.25)', position: "fixed", zIndex: "1301" }} >
            <CircularProgress sx={{ color: "white" }} />
          </Box>
        )}
      </> : null}
    </>
  );
};

export default EditEventoDialog;
