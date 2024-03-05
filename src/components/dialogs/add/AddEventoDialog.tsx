import { Add, ArrowDropDown } from "@mui/icons-material";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Button,
  ButtonGroup,
  Checkbox,
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
import { DatePicker } from "@mui/x-date-pickers";
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
interface AddEventoDialogProps {
  functionApp: () => void;
}
const AddEventoDialog: React.FC<AddEventoDialogProps> = ({ functionApp }) => {
  const [open, setOpen] = React.useState(false);
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
    setListPoste(await getPoste(sesion.token))
    setListObs(await getObs(sesion.token))
    setListTipoObs(await getTipoObs(sesion.token))
  }
  const handleClickOpen = () => {
    recibirDatos()
    setOpen(true);
  };

  const handleClose = () => {
    setData({ ...eventoExample })
    setOpen(false);
    setImage(null);
    functionApp();
    setListObsSelected([])
  };

  const onImageChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      setImage(event.target.files[0]);
    }
  };

  const handleGuardar = async () => {
    if (image && data.description != '' && data.id_poste != 0 && listObsSelected.length > 0) {
      const reponseUpload = await uploadImage(image, sesion.token);
      if (reponseUpload != "500") {
        const newData: EventoInterface = { ...data, image: reponseUpload };
        const reponse = await createEvento(newData, sesion.token);
        if (Number(reponse.status) === 200) {
          try {
            const newDataRevicion: RevicionInterface = { ...dataRevicion, id_evento: reponse.data.id ? reponse.data.id : 0 };
            await createRevicion(newDataRevicion, sesion.token);
            listObsSelected.map(async (obs: number) => {
              await createEventoObs({ id_obs: obs, id_evento: reponse.data.id ? reponse.data.id : 0 }, sesion.token);
            })
            enqueueSnackbar("Ingresado con exito", {
              variant: "success",
            })
            handleClose()
          } catch (e) {
            enqueueSnackbar("Error al ingresar las observaciones", {
              variant: "error",
            })
          }
        }
        else {
          enqueueSnackbar("No se pudo Ingresar", {
            variant: "error",
          });
        }
      } else {
        enqueueSnackbar("No se pudo Ingresar la imagen", {
          variant: "error",
        });
      }
    }
    else {
      enqueueSnackbar("Rellena todos los espacios", {
        variant: "warning",
      });
    }
  }

  return (
    <React.Fragment>
      <Button startIcon={<Add />} variant="outlined" onClick={handleClickOpen}>
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
                  renderOption={(props, option) => {
                    return (
                      <li {...props} key={option.id}>
                        {option.name}
                      </li>
                    );
                  }}
                  disablePortal
                  options={listPoste}
                  getOptionLabel={(option) => option.name}

                  onChange={(event, newValue) => {
                    const newData: EventoInterface = { ...data, id_poste: newValue?.id ? newValue?.id : 0 };
                    setData(newData)
                  }}
                  renderInput={(params) => <TextField {...params} label="Numero de poste" />}



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
                  onChange={(event) => {
                    const newData: EventoInterface = { ...data, description: event.target.value };
                    setData(newData)
                  }}
                />
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
                <Grid container m={0} p={0}>
                  <Grid item xs={12} paddingInline={0} paddingBlock={1}>
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
                        <Accordion sx={{ width: 1 }} variant="outlined">
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
                  <Input fullWidth onChange={onImageChange} type={"file"} />
                </Grid>

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
                  <DatePicker
                    sx={{ width: 1 }}

                    label="Fecha de revición"
                    format="DD-MM-YYYY"
                    defaultValue={dayjs(dataRevicion.date)}
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
    </React.Fragment>
  );
};
export default AddEventoDialog;


