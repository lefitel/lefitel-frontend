import { Add } from "@mui/icons-material";
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
import React, { useContext, useState } from "react";
import { posteExample } from "../../../data/example";
import { DatePicker } from "@mui/x-date-pickers";
import { AdssInterface, CiudadInterface, MaterialInterface, PosteInterface, PropietarioInterface } from "../../../interfaces/interfaces";
import { useSnackbar } from "notistack";
import { getAdss } from "../../../api/Adss.api";
import { getCiudad } from "../../../api/Ciudad.api";
import { getMaterial } from "../../../api/Material.api";
import { getPropietario } from "../../../api/Propietario.api";
import { uploadImage } from "../../../api/Upload.api";
import { createPoste } from "../../../api/Poste.api";
import dayjs from "dayjs";
import { createAdssPoste } from "../../../api/AdssPoste.api";
import { SesionContext } from "../../../context/SesionProvider";

interface AddPosteDialogProps {
  functionApp: () => void;
}
const AddPosteDialog: React.FC<AddPosteDialogProps> = ({ functionApp }) => {
  const [open, setOpen] = React.useState(false);
  const [image, setImage] = useState<File | null>();
  const [cargando, setCargando] = useState(false);

  const [data, setData] = React.useState<PosteInterface>({ ...posteExample });
  const { enqueueSnackbar } = useSnackbar();
  const [listAdssSelected, setListAdssSelected] = React.useState<number[]>([]);

  const [listAdss, setListAdss] = React.useState<AdssInterface[]>([]);
  const [listCiudad, setListCiudad] = React.useState<CiudadInterface[]>([]);
  const [listMaterial, setListMaterial] = React.useState<MaterialInterface[]>([]);
  const [listPropietario, setListPropietario] = React.useState<PropietarioInterface[]>([]);
  const { sesion } = useContext(SesionContext);




  const recibirDatos = async () => {
    setCargando(true)
    setListAdss(await getAdss(sesion.token))
    setListCiudad(await getCiudad(sesion.token))
    setListMaterial(await getMaterial(sesion.token))
    setListPropietario(await getPropietario(sesion.token))
    await setCargando(false)
  }
  const handleClickOpen = () => {
    recibirDatos()
    setOpen(true);
  };

  const handleClose = () => {
    setData(posteExample)
    setImage(null)
    setOpen(false);
    functionApp()
    setListAdssSelected([])
  };
  /* @ts-expect-error No se sabe el tipo de event */
  const onImageChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      setImage(event.target.files[0]);
    }
  };
  function LocationMarker() {
    /* @ts-expect-error No se sabe el tipo de event */
    const map = useMapEvent('click', (event) => {
      const newData: PosteInterface = { ...data, lat: event.latlng.lat, lng: event.latlng.lng };
      setData(newData)

      map.flyTo(event.latlng, map.getZoom())

    })
    return null
  }


  const handleGuardar = async () => {
    setCargando(true)
    if (image && data.name != '' && data.id_ciudadA != 0 && data.id_ciudadB != 0 && data.id_material != 0 && data.id_propietario != 0 && listAdssSelected.length > 0) {
      if (data.id_ciudadA != data.id_ciudadB) {
        const reponseUpload = await uploadImage(image, sesion.token);
        if (reponseUpload != "500") {
          const newData: PosteInterface = { ...data, image: reponseUpload, id_usuario: sesion.usuario.id ? sesion.usuario.id : 0 };
          const reponse = await createPoste(newData, sesion.token);

          if (Number(reponse.status) === 200) {
            try {
              listAdssSelected.map(async (adss: number) => {

                await createAdssPoste({ id_adss: adss, id_poste: reponse.data.id as number }, sesion.token);
              })
              await enqueueSnackbar("Ingresado con exito", {
                variant: "success",
              })

              await setData(posteExample)
              await setListAdssSelected([])
              await setImage(null)
              await setCargando(false)
              //await handleClose()



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

          enqueueSnackbar("No se pudo Ingresar la imagen", {
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
  return (
    <React.Fragment>
      <Button startIcon={<Add />} onClick={handleClickOpen}>
        {"Nuevo Poste"}
      </Button>
      <Dialog
        fullWidth
        open={open}
        onClose={handleClose}
      >
        <DialogTitle>{"Añadir un nuevo poste"}</DialogTitle>
        <DialogContent>
          <Grid container width={1} m={0}>
            <Grid item xs={12} md={4}>
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
            <Grid item xs={12} md={8}>
              <DatePicker
                sx={{ width: 1 }}
                label="Fecha"
                format="DD-MM-YYYY"
                value={dayjs(data.date)}

                onChange={(date) => {
                  if (date) {
                    const newData: PosteInterface = { ...data, date: date.toDate() };
                    setData(newData)
                    //console.log(newData)
                  }
                }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Autocomplete
                renderOption={(props, option: PropietarioInterface) => {
                  return (
                    <li {...props} key={option.id}>
                      {option.name}
                    </li>
                  );
                }}
                disablePortal
                options={listPropietario}
                getOptionLabel={(option: PropietarioInterface) => {
                  return option.name ? option.name : ""
                }}
                onChange={(_event, newValue: PropietarioInterface | null) => {
                  const newData: PosteInterface = { ...data, id_propietario: newValue?.id ? newValue?.id : 0, propietario: newValue };
                  setData(newData)
                }}
                renderInput={(params) => <TextField {...params} label="Propietario" />}
                value={data.propietario ? data.propietario : null}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Autocomplete
                renderOption={(props, option: MaterialInterface) => {
                  return (
                    <li {...props} key={option.id}>
                      {option.name}
                    </li>
                  );
                }}
                disablePortal

                options={listMaterial}
                getOptionLabel={(option) => {
                  return option.name ? option.name : ""
                }}
                onChange={(_event, newValue: MaterialInterface | null) => {
                  const newData: PosteInterface = { ...data, id_material: newValue?.id ? newValue?.id : 0, material: newValue };
                  setData(newData)
                }}
                renderInput={(params) => <TextField {...params} label="Material" />}
                value={data.material ? data.material : null}

              />
            </Grid>

            <Grid item xs={12} sx={{ p: 0 }}>
              <Typography
                display={"flex"}
                color="text.secondary"
                paddingInline={1}
                textAlign={"left"}
              >
                Tramo:
              </Typography>

              <Grid container sx={{ p: 0 }}>
                <Grid item xs={6} p={0}>
                  <Autocomplete
                    renderOption={(props, option: CiudadInterface) => {
                      return (
                        <li {...props} key={option.id}>
                          {option.name}
                        </li>
                      );
                    }}
                    disablePortal

                    options={listCiudad}
                    getOptionLabel={(option: CiudadInterface) => option.name ? option.name : ""}

                    onChange={(_event, newValue: CiudadInterface | null) => {
                      const newData: PosteInterface = { ...data, id_ciudadA: newValue?.id ? newValue?.id : 0, ciudadA: newValue };
                      setData(newData)
                    }}
                    renderInput={(params) => <TextField {...params} label="Inicio" />}
                    value={data.ciudadA ? data.ciudadA : null}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Autocomplete
                    renderOption={(props, option: CiudadInterface) => {
                      return (
                        <li {...props} key={option.id}>
                          {option.name}
                        </li>
                      );
                    }}
                    disablePortal

                    options={listCiudad}
                    getOptionLabel={(option: CiudadInterface) => option.name ? option.name : ""}

                    onChange={(_event, newValue: CiudadInterface | null) => {
                      const newData: PosteInterface = { ...data, id_ciudadB: newValue?.id ? newValue?.id : 0, ciudadB: newValue };
                      setData(newData)
                    }}
                    renderInput={(params) => <TextField {...params} label="Inicio" />}
                    value={data.ciudadB ? data.ciudadB : null}
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
                Adss-Ferreteria de sujeción:
              </Typography>

              <Grid justifyContent={"left"} container sx={{ p: 0 }}>
                {listAdss.map((adds, i) => (
                  <Grid key={i} item xs={6} sx={{ p: 0 }}>
                    <FormControlLabel
                      control={
                        <Checkbox

                          checked={adds.id ? listAdssSelected.includes(adds.id) : false}
                          onChange={(event) => {
                            if (event.target.checked) {
                              setListAdssSelected(prevLista => [...prevLista, adds.id ? adds.id : 0])
                            }
                            else {
                              const nuevaLista = listAdssSelected.filter(item => item !== adds.id);
                              console.log(nuevaLista)
                              setListAdssSelected(nuevaLista);
                            }
                          }}
                        />}
                      sx={{
                        margin: 0,
                      }}
                      label={adds.name}
                    />
                  </Grid>
                ))}
              </Grid>
            </Grid>
            <Grid
              item
              xs={12}
              md={6}
              sx={{ p: 0 }}
            >
              <Grid container m={0} sx={{ p: 0 }}>
                <Grid item xs={12}>
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
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Latitud"
                      value={data.lat}
                      onChange={(event) => {
                        const newData: PosteInterface = { ...data, lat: parseFloat(event.target.value) };
                        setData(newData)
                      }}
                    />
                  </Grid>
                  <Grid item xs={6} >
                    <TextField
                      fullWidth
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
              <Grid item xs={12} >

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
          </Grid>
        </DialogContent>
        <DialogActions>
          <ButtonGroup>
            <Button onClick={handleClose}>Cancelar</Button>
            <Button onClick={handleGuardar}>Insertar</Button>


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

export default AddPosteDialog;
