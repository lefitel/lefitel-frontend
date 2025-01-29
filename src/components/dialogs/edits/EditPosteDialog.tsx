import {
  Autocomplete,
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  Input,
  TextField,
  Typography,
} from "@mui/material";
import { MapContainer, Marker, Popup, TileLayer, useMapEvent } from "react-leaflet";
import React, { useContext, useEffect, useState } from "react";
import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import { DatePicker } from "@mui/x-date-pickers";
import { useSnackbar } from "notistack";
import { AdssInterface, AdssPosteInterface, CiudadInterface, MaterialInterface, PosteInterface, PropietarioInterface } from "../../../interfaces/interfaces";
import { getAdss } from "../../../api/Adss.api";
import { getCiudad } from "../../../api/Ciudad.api";
import { getMaterial } from "../../../api/Material.api";
import { getPropietario } from "../../../api/Propietario.api";
import { url } from "../../../api/url";
import dayjs from "dayjs";
import { createAdssPoste, deleteAdssPoste, getAdssPoste } from "../../../api/AdssPoste.api";
import { uploadImage } from "../../../api/Upload.api";
import { deletePoste, editPoste } from "../../../api/Poste.api";
import { posteExample } from "../../../data/example";
import { getEvento_poste } from "../../../api/Evento.api";
import { SesionContext } from "../../../context/SesionProvider";


interface EditPosteDialogProps {
  poste: PosteInterface;
  setPoste: (poste: PosteInterface) => void;

  functionApp: () => void;
  setOpen: (open: boolean) => void;
  open: boolean;
}
const EditPosteDialog: React.FC<EditPosteDialogProps> = ({ poste, setPoste, functionApp, setOpen, open }) => {
  const [cargando, setCargando] = useState(false);

  const [data, setData] = useState(poste);
  const [image, setImage] = useState<File | null>();

  const { enqueueSnackbar } = useSnackbar();
  const [listAdssSelected, setListAdssSelected] = React.useState<number[]>([]);
  const [listAdssPoste, setListAdssPoste] = React.useState<AdssPosteInterface[]>([]);

  const [listAdss, setListAdss] = React.useState<AdssInterface[]>([]);
  const [listCiudad, setListCiudad] = React.useState<CiudadInterface[]>([]);
  const [listMaterial, setListMaterial] = React.useState<MaterialInterface[]>([]);
  const [listPropietario, setListPropietario] = React.useState<PropietarioInterface[]>([]);
  const [openDelete, setOpenDelete] = useState(false);
  const { sesion } = useContext(SesionContext);

  useEffect(() => {
    console.log(poste)
    recibirDatos()
  }, [open])

  const recibirDatos = async () => {
    setCargando(true)
    const adssposteTemp = await getAdssPoste(data.id as number, sesion.token)
    await setListAdssPoste(adssposteTemp)
    const ids = await adssposteTemp.map(objeto => objeto.id) ? adssposteTemp.map(objeto => objeto.id_adss) : [];

    setListAdssSelected(ids as [])
    setListAdss(await getAdss(sesion.token))
    setListCiudad(await getCiudad(sesion.token))
    setListMaterial(await getMaterial(sesion.token))
    setListPropietario(await getPropietario(sesion.token))
    await setCargando(false)
  }


  const handleClose = () => {
    setOpen(false);
    setPoste(posteExample)
    functionApp();
    setListAdssSelected([]);
    //setListAdssPoste([]);
  };
  const handleClickOpenDelete = () => {

    setOpenDelete(true);
  };

  const handleCloseDelete = () => {
    setOpenDelete(false);
  };

  // @ts-expect-error No se sabe el tipo de event
  const onImageChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      setImage(event.target.files[0]);
    }
  };

  function LocationMarker() {
    // @ts-expect-error No se sabe el tipo de event
    const map = useMapEvent('click', (event) => {
      const newData: PosteInterface = { ...data, lat: event.latlng.lat, lng: event.latlng.lng };
      setData(newData)
      map.flyTo(event.latlng, map.getZoom())

    })


    return null
  }

  const handleEdit = async () => {
    setCargando(true)
    if (data.name != '' && data.id_ciudadA != 0 && data.id_ciudadB != 0 && data.id_material != 0 && data.id_propietario != 0 && listAdssSelected.length > 0) {
      if (data.id_ciudadA != data.id_ciudadB) {
        let newData: PosteInterface = { ...data }
        if (image) {
          const reponseUpload = await uploadImage(image, sesion.token);
          if (reponseUpload != "500") {
            newData = { ...newData, image: reponseUpload };
          }
          else {
            enqueueSnackbar("No se pudo Ingresar la imagen", {
              variant: "error",
            });
          }
        }
        const reponse = await editPoste(newData, sesion.token);
        if (Number(reponse.status) === 200) {
          try {
            const diferenciasAñadir = listAdssSelected.filter(numero => listAdssPoste.every(objeto => objeto.id_adss !== numero));
            const diferenciasEliminar = listAdssPoste.filter(objeto => listAdssSelected.every(numero => objeto.id_adss !== numero))
              .map(objeto => objeto.id);
            diferenciasAñadir.map(async (adss: number) => {
              await createAdssPoste({ id_adss: adss, id_poste: reponse.data.id as number }, sesion.token);
            })
            diferenciasEliminar.map(async (adss) => {
              await deleteAdssPoste(adss as number, sesion.token);
            }
            )
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
      } else {
        setCargando(false)
        enqueueSnackbar("Las ciudades son iguales", {
          variant: "warning",
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
    const listEvento = await getEvento_poste(data?.id as number, sesion.token);
    if (listEvento.length < 1) {
      listAdssPoste.map((adssPoste) => {
        deleteAdssPoste(adssPoste?.id as number, sesion.token);
      })
      const reponse = await deletePoste(data?.id as number, sesion.token);
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
      setCargando(false)
      enqueueSnackbar("No se pudo Eliminar porque tiene eventos asociados", {
        variant: "error",
      });
    }
  }

  return (
    <>
      <Dialog
        fullWidth
        open={open}
        onClose={handleClose}
      >
        <DialogTitle>{"Edita los datos del poste"}</DialogTitle>
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
            <Grid item xs={12} md={5}>
              <TextField
                fullWidth
                style={{
                  padding: 0,
                  margin: 0,
                }}
                disabled
                label="Usuario Creador"
                value={data.usuario?.name}
              />
            </Grid>
            <Grid item xs={12} md={5}>
              <TextField

                fullWidth
                style={{
                  padding: 0,
                  margin: 0,
                }}
                label="Numero de poste"
                value={data.name}
                onChange={(event) => {
                  const newData: PosteInterface = { ...data, name: event.target.value };
                  setData(newData)
                }}

              />
            </Grid>

            <Grid item xs={12} md={6}>
              <DemoContainer sx={{ p: 0 }} components={["DatePicker"]}>
                <DatePicker
                  sx={{ width: 1 }}
                  label="Fecha"
                  format="DD-MM-YYYY"
                  defaultValue={dayjs(data.date)}
                  onChange={(date) => {
                    if (date) {
                      const newData: PosteInterface = { ...data, date: date.toDate() };
                      setData(newData)
                    }
                  }}
                />
              </DemoContainer>
            </Grid>


            <Grid item xs={12} md={6}>
              <Autocomplete
                renderOption={(props, option) => {
                  return (
                    <li {...props} key={option.id}>
                      {option.name}
                    </li>
                  );
                }}
                disablePortal
                options={listPropietario}
                getOptionLabel={(option) => option.name}
                value={listPropietario.find(tipoObs => tipoObs.id === data.id_propietario) || null}
                onChange={(_event, newValue) => {
                  const newData: PosteInterface = { ...data, id_propietario: newValue?.id ? newValue?.id : 0 };
                  setData(newData)
                }}
                renderInput={(params) => <TextField {...params} label="Propietario" />}
              />
            </Grid>
            <Grid item xs={12} md={12}>
              <Autocomplete
                renderOption={(props, option) => {
                  return (
                    <li {...props} key={option.id}>
                      {option.name}
                    </li>
                  );
                }}
                disablePortal
                options={listMaterial}
                getOptionLabel={(option) => option.name}
                value={listMaterial.find(tipoObs => tipoObs.id === data.id_material) || null}
                onChange={(_event, newValue) => {
                  const newData: PosteInterface = { ...data, id_material: newValue?.id ? newValue?.id : 0 };
                  setData(newData)
                }}
                renderInput={(params) => <TextField {...params} label="Material" />}
              />
            </Grid>

            <Grid item xs={12} paddingInline={0} paddingBlock={1} sx={{ p: 0 }}>
              <Typography
                display={"flex"}
                color="text.secondary"
                textAlign={"left"}
                paddingInline={1}
                pt={1}
              >
                Tramo:
              </Typography>

              <Grid container sx={{ p: 0 }}>
                <Grid item xs={6}>
                  <Autocomplete
                    renderOption={(props, option) => {
                      return (
                        <li {...props} key={option.id}>
                          {option.name}
                        </li>
                      );
                    }}
                    disablePortal
                    options={listCiudad}
                    getOptionLabel={(option) => option.name}
                    value={listCiudad.find(tipoObs => tipoObs.id === data.id_ciudadA) || null}
                    onChange={(_event, newValue) => {
                      const newData: PosteInterface = { ...data, id_ciudadA: newValue?.id ? newValue?.id : 0 };
                      setData(newData)
                    }}
                    renderInput={(params) => <TextField {...params} label="Inicio" />}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Autocomplete
                    renderOption={(props, option) => {
                      return (
                        <li {...props} key={option.id}>
                          {option.name}
                        </li>
                      );
                    }}
                    disablePortal
                    options={listCiudad}
                    getOptionLabel={(option) => option.name}
                    value={listCiudad.find(tipoObs => tipoObs.id === data.id_ciudadB) || null}
                    onChange={(_event, newValue) => {
                      const newData: PosteInterface = { ...data, id_ciudadB: newValue?.id ? newValue?.id : 0 };
                      setData(newData)
                    }}
                    renderInput={(params) => <TextField {...params} label="Inicio" />}
                  />
                </Grid>
              </Grid>
            </Grid>
            <Grid item xs={12} sx={{ p: 0 }}>
              <Typography
                display={"flex"}
                color="text.secondary"
                textAlign={"left"}
                paddingInline={1}
                pb={0}
              >
                Ferreteria de sujeción:
              </Typography>

              <Grid container justifyContent={"left"} sx={{ p: 0 }}>
                {listAdss.map((adss, i) => {

                  return <Grid key={i} item xs={6} sx={{ p: 0 }}>
                    <FormControlLabel
                      control={<Checkbox
                        checked={listAdssSelected?.some(objeto => objeto === adss.id)}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setListAdssSelected(prevLista => [...prevLista, adss.id ? adss.id : 0])
                          }
                          else {
                            const nuevaLista = listAdssSelected.filter(item => item !== adss.id);
                            //console.log(nuevaLista)
                            setListAdssSelected(nuevaLista);
                          }
                        }}
                      />}
                      sx={{
                        margin: 0,
                      }}
                      label={adss.name}
                    />
                  </Grid>
                }
                )}
              </Grid>
            </Grid>
            <Grid
              item
              sx={{ p: 0 }}
              xs={12}
              md={6}
              paddingBlock={1}
              paddingInline={0}
            >
              <Grid container sx={{ p: 0 }}>
                <Grid item xs={12} sx={{ p: 0 }}>
                  <Typography
                    display={"flex"}
                    color="text.secondary"
                    textAlign={"left"}
                    paddingInline={1}
                  >
                    Ubicación:
                  </Typography>
                </Grid>
                <Grid container sx={{ p: 0 }}>
                  <Grid item xs={6} >
                    <TextField
                      fullWidth
                      style={{
                        padding: 0,
                        margin: 0,
                      }}
                      type="number"
                      label="Latitud"
                      value={data.lat}
                      onChange={(event) => {
                        const newData: PosteInterface = { ...data, lat: parseFloat(event.target.value) };
                        setData(newData)
                      }}
                    />
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      style={{
                        padding: 0,
                        margin: 0,
                      }}
                      type="number"
                      label="Longitud"
                      value={data.lng}

                      onChange={(event) => {
                        const newData: PosteInterface = { ...data, lng: parseFloat(event.target.value) };
                        setData(newData)
                      }}
                    />
                  </Grid>
                </Grid>
              </Grid>
              <Grid item xs={12}>
                {/* @ts-expect-error No se sabe el tipo de event */}
                <MapContainer center={[data.lat, data.lng]}
                  zoom={13}
                  style={{ height: "240px" }}
                  scrollWheelZoom={false}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png" />
                  <LocationMarker />
                  <Marker position={[data.lat, data.lng]}>
                    <Popup>You are here</Popup>
                  </Marker>
                </MapContainer>
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
          </Grid>
        </DialogContent>
        {sesion.usuario.id_rol != 3 ?

          <DialogActions style={{
            display: "flex",
            justifyContent: "space-between"
          }}>
            <Grid>
              {sesion.usuario.id_rol === 1 ? <>
                <Button onClick={handleClickOpenDelete}>
                  {"Eliminar"}
                </Button>
              </> : null}
            </Grid>
            <ButtonGroup>
              <Button onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleEdit}>Editar</Button>
            </ButtonGroup>

          </DialogActions>
          : null}

        {sesion.usuario.id_rol === 1 ? <>

          <Dialog
            open={openDelete}
            onClose={handleCloseDelete}
          >
            <DialogTitle>{"Eliminar Poste"}</DialogTitle>
            <DialogContent>
              <Grid container width={1} m={0}>
                Seguro que quiere eliminar este Poste?
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
    </>

  );
};

export default EditPosteDialog;
