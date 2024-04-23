import { Add, ArrowDropDown } from "@mui/icons-material";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Grid,
  Input,
  TextField,
  Typography,
} from "@mui/material";
import React, { useContext, useState } from "react";
import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import { DateTimePicker } from "@mui/x-date-pickers";
import { EventoInterface, ObsInterface, PosteInterface, RevicionInterface, TipoObsInterface } from "../../../interfaces/interfaces";
import { eventoExample, revicionExample } from "../../../data/example";
import { getObs } from "../../../api/Obs.api";
import { getTipoObs } from "../../../api/TipoObs.api";
import { useSnackbar } from "notistack";
import dayjs from "dayjs";
import { uploadImage } from "../../../api/Upload.api";
import { createEvento } from "../../../api/Evento.api";
import { createEventoObs } from "../../../api/EventoObs.api";
import { createRevicion } from "../../../api/Revicion.api";
import { getPoste } from "../../../api/Poste.api";
import { SesionContext } from "../../../context/SesionProvider";
import { url } from "../../../api/url";
interface AddEventoDialogProps {
  functionApp: () => void;
}
const AddEventoDialog: React.FC<AddEventoDialogProps> = ({ functionApp }) => {
  const [open, setOpen] = useState(false);
  const [cargando, setCargando] = useState(false);

  const [image, setImage] = useState<File | null>();
  const [data, setData] = React.useState<EventoInterface>({ ...eventoExample });
  const [dataRevicion, setDataRevicion] = React.useState<RevicionInterface>(revicionExample);
  const [listObsSelected, setListObsSelected] = React.useState<number[]>([]);

  const { enqueueSnackbar } = useSnackbar();

  const [listObs, setListObs] = React.useState<ObsInterface[]>([]);
  const [listTipoObs, setListTipoObs] = React.useState<TipoObsInterface[]>([]);

  const [listPoste, setListPoste] = React.useState<PosteInterface[]>([]);
  const { sesion } = useContext(SesionContext);

  const recibirDatos = async () => {
    setCargando(true)

    setListPoste(await getPoste(sesion.token))
    setListObs(await getObs(sesion.token))
    setListTipoObs(await getTipoObs(sesion.token))
    await setCargando(false)
  }
  const handleClickOpen = () => {
    recibirDatos()
    setOpen(true);
  };

  const handleClose = () => {
    setData({ ...eventoExample })
    setDataRevicion(revicionExample)
    setOpen(false);
    setImage(null);
    functionApp();
    setListObsSelected([])
  };
  /* @ts-expect-error No se sabe el tipo de event */
  const onImageChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      setImage(event.target.files[0]);
    }
  };




  const loadImageFromUrl = async (url: string): Promise<File | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Error al cargar la imagen desde la URL');
      }
      const blob = await response.blob();
      // Crear un nuevo objeto File a partir del Blob
      const file = new File([blob], 'imagen.jpg', { type: blob.type });
      return file;
    } catch (error) {
      console.error('Error:', error);
      return null;
    }
  };

  // Función para manejar la carga de imagen desde una URL
  const onImageChangeFromUrl = async (url: string) => {
    const imageBlob = await loadImageFromUrl(url);
    if (imageBlob) {
      setImage(imageBlob);
    } else {
      setImage(null); // Establecer null si no se puede cargar la imagen
    }
  };











  const handleGuardar = async () => {
    setCargando(true)

    if (image && data.description != '' && data.id_poste != 0 && listObsSelected.length > 0) {
      const reponseUpload = await uploadImage(image, sesion.token);
      if (reponseUpload != "500") {
        const newData: EventoInterface = { ...data, image: reponseUpload, date: dataRevicion.date, id_usuario: sesion.usuario.id ? sesion.usuario.id : 0 };
        const reponse = await createEvento(newData, sesion.token);
        if (Number(reponse.status) === 200) {
          try {
            const newDataRevicion: RevicionInterface = { ...dataRevicion, id_evento: reponse.data.id ? reponse.data.id : 0 };
            await createRevicion(newDataRevicion, sesion.token);
            listObsSelected.map(async (obs: number) => {
              await createEventoObs({ id_obs: obs, id_evento: reponse.data.id ? reponse.data.id : 0 }, sesion.token);
            })
            await setCargando(false)
            await setData(eventoExample)
            await setListObsSelected([])
            await setDataRevicion(revicionExample)
            await setImage(null)
            //await handleClose()
            await enqueueSnackbar("Ingresado con exito", {
              variant: "success",
            })


          } catch (e) {
            setCargando(false)
            enqueueSnackbar("Error al ingresar las observaciones", {
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
      } else {
        setCargando(false)
        enqueueSnackbar("No se pudo Ingresar la imagen", {
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

  return (
    <React.Fragment>
      <Button startIcon={<Add />} onClick={handleClickOpen}>
        {"Nuevo Evento"}
      </Button>
      <Dialog
        fullWidth
        open={open}
        onClose={handleClose}
      >
        <DialogTitle>{"Ingresar un nuevo evento"}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <Grid container width={1} m={0}>
              <Grid item xs={12} md={4}>
                <Autocomplete
                  renderOption={(props, option: PosteInterface) => {
                    return (
                      <li {...props} key={option.id}>
                        {option.name}
                      </li>
                    );
                  }}
                  disablePortal
                  options={listPoste}
                  getOptionLabel={(option: PosteInterface) => option.name ? option.name : ""}

                  onChange={(_event, newValue: PosteInterface | null) => {
                    const newData: EventoInterface = { ...data, id_poste: newValue?.id ? newValue?.id : 0, poste: newValue };
                    setData(newData),
                      console.log(newValue)
                    onImageChangeFromUrl(`${url}${newValue?.image}`)
                  }}
                  renderInput={(params) => <TextField {...params} label="Numero de poste" />}

                  value={data.poste ? data.poste : null}


                />
              </Grid>

              <Grid item xs={12} md={8}>
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
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  disabled
                  style={{
                    padding: 0,
                    margin: 0,
                  }}
                  label="Tramo inicial"
                  value={data.poste?.ciudadA?.name ? data.poste?.ciudadA?.name : ""}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  disabled
                  style={{
                    padding: 0,
                    margin: 0,
                  }}
                  label="Tramo Final"
                  value={data.poste?.ciudadB?.name ? data.poste?.ciudadB?.name : ""}
                />
              </Grid>

              <Grid
                item
                xs={12}
                md={6}
              >
                <Grid container sx={{ p: 0, justifyContent: "left" }} >
                  <Typography
                    display={"flex"}
                    color="text.secondary"
                    textAlign={"left"}
                    paddingInline={1}
                  >
                    Observaciones:
                  </Typography>



                  {
                    listTipoObs.map((tipoObs, i) =>
                    (
                      <Grid key={i} item xs={12} sx={{ p: 0 }}>
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
                                        checked={obs.id ? listObsSelected.includes(obs.id) : false}

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
                    loading="lazy"
                    src={"https://as2.ftcdn.net/v2/jpg/03/49/49/79/1000_F_349497933_Ly4im8BDmHLaLzgyKg2f2yZOvJjBtlw5.jpg"}
                    alt="Preview" />
                }
              </Grid>
              <Grid item xs={12} md={6}>
                <DemoContainer sx={{ p: 0 }} components={["DatePicker"]}>
                  <DateTimePicker
                    sx={{ width: 1 }}

                    label="Fecha de revición"
                    format="DD-MM-YYYY"
                    value={dayjs(dataRevicion.date)}

                    onChange={(date) => {
                      if (date) {
                        const newData: RevicionInterface = { ...dataRevicion, date: date.toDate() };
                        setDataRevicion(newData)
                        //console.log(newData)
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
                  onChange={(event) => {
                    const newData: RevicionInterface = { ...dataRevicion, description: event.target.value };
                    setDataRevicion(newData)
                  }}
                  value={dataRevicion.description}
                />
              </Grid>
            </Grid>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <ButtonGroup>
            <Button onClick={handleClose}>Cancelar</Button>
            <Button onClick={handleGuardar}>Guardar</Button>


          </ButtonGroup>
        </DialogActions>
      </Dialog>
      {cargando && (
        <Box sx={{ height: "100vh", width: "100vw", top: 0, left: 0, alignContent: "center", backgroundColor: 'rgba(0, 0, 0, 0.25)', position: "fixed", zIndex: "1301" }} >
          <CircularProgress sx={{ color: "white" }} />
        </Box>
      )}
    </React.Fragment>
  );
};
export default AddEventoDialog;


