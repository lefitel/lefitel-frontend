import {
  Autocomplete,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardActions,
  CardContent,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  Input,
  LinearProgress,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import AddPosteDialog from "../../components/dialogs/add/AddPosteDialog";
import { editPoste, getPoste } from "../../api/Poste.api";
import { AdssInterface, AdssPosteInterface, CiudadInterface, MaterialInterface, PosteInterface, PropietarioInterface } from "../../interfaces/interfaces";
import { useEffect, useState } from "react";
import { latExample, lngExample, posteExample } from "../../data/example";
import { MapContainer, Marker, Popup, TileLayer, useMapEvent } from "react-leaflet";
import { useSnackbar } from "notistack";
import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import { DatePicker } from "@mui/x-date-pickers";
import { uploadImage } from "../../api/Upload.api";
import { createAdssPoste, deleteAdssPoste, getAdssPoste } from "../../api/AdssPoste.api";
import { url } from "../../api/url";
import dayjs from "dayjs";
import { getAdss } from "../../api/Adss.api";
import { getMaterial } from "../../api/Material.api";
import { getPropietario } from "../../api/Propietario.api";
import { getCiudad } from "../../api/Ciudad.api";

const columns = [
  { field: 'id', headerName: 'Id', width: 15 },
  { field: 'name', headerName: 'Nombre', width: 100 },
  { field: 'lat', headerName: 'Latitud', width: 150 },
  { field: 'lng', headerName: 'Longitud', width: 150 },
  { field: 'id_material', headerName: 'Material', width: 150 },
  { field: 'id_propietario', headerName: 'Propietario', width: 150 },
  { field: 'id_ciudadA', headerName: 'Tramo de Inicio', width: 150 },
  { field: 'id_ciudadB', headerName: 'Tramo de Fin', width: 150 },
  {
    field: 'createdAt', headerName: 'Creación', width: 150,
    valueGetter: (params) => {
      const date = new Date(params.row.createdAt);
      return date.toLocaleString();

    }
  },
  {
    field: 'updatedAt', headerName: 'Edición', width: 150,
    valueGetter: (params) => {
      const date = new Date(params.row.updatedAt);
      return date.toLocaleString();

    }
  },
];
interface PosteSecProps {
  setposte: React.Dispatch<React.SetStateAction<number | null>>;
}
const PosteSec: React.FC<PosteSecProps> = ({ setposte }) => {
  const [list, setList] = useState<PosteInterface[]>();
  const [openDelete, setOpenDelete] = useState(false);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PosteInterface>(posteExample);
  const [image, setImage] = useState<File | null>();

  const { enqueueSnackbar } = useSnackbar();
  const [listAdssSelected, setListAdssSelected] = useState<number[]>([]);
  const [listAdssPoste, setListAdssPoste] = useState<AdssPosteInterface[]>([]);

  const [listAdss, setListAdss] = useState<AdssInterface[]>([]);
  const [listCiudad, setListCiudad] = useState<CiudadInterface[]>([]);
  const [listMaterial, setListMaterial] = useState<MaterialInterface[]>([]);
  const [listPropietario, setListPropietario] = useState<PropietarioInterface[]>([]);



  useEffect(() => {
    recibirDatos()
    return () => {
      setListAdssSelected([])

    }
  }, [open])



  const recibirDatos = async () => {
    setList(await getPoste())
  }

  const recibirDatosEdit = async (dataEdit: PosteInterface) => {
    const adssposteTemp = await getAdssPoste(dataEdit.id ? dataEdit.id : 0)
    await setListAdssPoste(adssposteTemp)
    const ids = await adssposteTemp.map(objeto => objeto.id) ? listAdssPoste.map(objeto => objeto.id_adss) : [];
    setListAdssSelected(ids as [])
    setListAdss(await getAdss())
    setListCiudad(await getCiudad())
    setListMaterial(await getMaterial())
    setListPropietario(await getPropietario())
  }

  const handleClickOpenEdit = (rows: PosteInterface) => {
    recibirDatosEdit(rows)
    setData(rows);
    setOpen(true);
  };

  const handleCloseEdit = () => {
    setListAdssSelected([])
    setOpen(false);
  };

  const handleClickOpenDelete = () => {
    setOpenDelete(true);
  };

  const handleCloseDelete = () => {
    setOpenDelete(false);
  };


  const onImageChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      setImage(event.target.files[0]);
    }
  };
  function LocationMarker() {
    const [position, setPosition] = useState([latExample, lngExample])
    const map = useMapEvent('click', (event) => {
      const newData: PosteInterface = { ...data, lat: event.latlng.lat, lng: event.latlng.lng };
      setData(newData)
      setPosition(event.latlng)
      map.flyTo(event.latlng, map.getZoom())
    })
    return null
  }


  const handleEditPoste = async () => {
    //console.log(data)

    if (data.name != '' && data.id_ciudadA != 0 && data.id_ciudadB != 0 && data.id_material != 0 && data.id_propietario != 0 && listAdssSelected.length > 0) {


      if (data.id_ciudadA != data.id_ciudadB) {
        let newData: PosteInterface = { ...data }

        if (image) {
          const reponseUpload = await uploadImage(image);
          if (reponseUpload != "500") {
            newData = { ...newData, image: reponseUpload };
          }
          else {
            enqueueSnackbar("No se pudo Ingresar la imagen", {
              variant: "error",
            });
          }
        }
        const reponse = await editPoste(newData);


        if (Number(reponse.status) === 200) {
          try {

            const diferenciasAñadir = listAdssSelected.filter(numero => listAdssPoste.every(objeto => objeto.id_adss !== numero));
            const diferenciasEliminar = listAdssPoste.filter(objeto => listAdssSelected.every(numero => objeto.id_adss !== numero))
              .map(objeto => objeto.id);

            //console.log("------------------------------------------------")
            //console.log(diferenciasAñadir)
            //console.log(diferenciasEliminar)

            //console.log("------------------------------------------------")

            diferenciasAñadir.map(async (adss) => {

              await createAdssPoste({ id_adss: adss, id_poste: reponse.data.id ? reponse.data.id : 0 });
            })
            diferenciasEliminar.map(async (adss) => {
              await deleteAdssPoste(adss ? adss : 0);


            }

            )
            enqueueSnackbar("Ingresado con exito", {
              variant: "success",
            })
            handleCloseEdit()
          } catch (e) {
            enqueueSnackbar("Error al ingresar los Adss", {
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
        enqueueSnackbar("Las ciudades son iguales", {
          variant: "warning",
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
    <Grid
      container
      sx={{
        height: { xs: "auto", md: "calc(100vh - 64px)" },
        alignItems: "stretch",
        margin: 0,
      }}
    >
      <Grid display={"flex"} flexDirection={"column"} item xs={12} md={12}>
        <Card sx={{ flex: 1 }} variant="outlined" style={{}}>
          <CardContent style={{}}>
            <CardActions
              style={{
                paddingInline: 0,
              }}
            >
              <ButtonGroup
                size="small"
                variant="outlined"
                aria-label="outlined primary button group"
              >
                <AddPosteDialog functionApp={recibirDatos} />
              </ButtonGroup>
            </CardActions>
            <Box
              sx={{
                height: {
                  xs: "calc(100vh - 105px)",
                  md: "calc(100vh - 200px)",
                },
                width: {
                  xs: "calc(100vw - 100px)",
                  sm: "calc(100vw - 115px)",
                  md: "calc(100vw - 115px)",
                },
              }}
            >
              <DataGrid
                //className="datagrid-content"
                rows={list ? list : []}
                columns={columns}
                experimentalFeatures={{ lazyLoading: true }}
                rowsLoadingMode="server"
                hideFooterPagination
                rowHeight={38}
                disableRowSelectionOnClick
                slots={{
                  toolbar: GridToolbar,
                  loadingOverlay: LinearProgress,
                }}
                slotProps={{ toolbar: { showQuickFilter: true } }}
                onRowClick={(params) => {
                  handleClickOpenEdit(params.row);
                }}
                hideFooter
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>
      <Dialog
        fullWidth
        open={open}
        onClose={handleCloseEdit}
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
                onChange={(event, newValue) => {
                  const newData: PosteInterface = { ...data, id_propietario: newValue?.id ? newValue?.id : 0 };
                  setData(newData)
                }}
                renderInput={(params) => <TextField {...params} label="Propietario" />}
              />
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
                options={listMaterial}
                getOptionLabel={(option) => option.name}
                value={listMaterial.find(tipoObs => tipoObs.id === data.id_material) || null}
                onChange={(event, newValue) => {
                  const newData: PosteInterface = { ...data, id_material: newValue?.id ? newValue?.id : 0 };
                  setData(newData)
                }}
                renderInput={(params) => <TextField {...params} label="Material" />}
              />
            </Grid>

            <Grid item xs={12} paddingInline={0} paddingBlock={1}>
              <Typography
                display={"flex"}
                color="text.secondary"
                textAlign={"left"}
                paddingInline={1}
                pt={1}
              >
                Tramo:
              </Typography>

              <Grid container p={0} m={0}>
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
                    onChange={(event, newValue) => {
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
                    onChange={(event, newValue) => {
                      const newData: PosteInterface = { ...data, id_ciudadB: newValue?.id ? newValue?.id : 0 };
                      setData(newData)
                    }}
                    renderInput={(params) => <TextField {...params} label="Inicio" />}
                  />
                </Grid>
              </Grid>
            </Grid>
            <Grid item xs={12} paddingInline={0} paddingBlock={1}>
              <Typography
                display={"flex"}
                color="text.secondary"
                textAlign={"left"}
                paddingInline={1}
                pb={0}
              >
                Ferreteria de sujeción:
              </Typography>

              <Grid container m={0} p={0} justifyContent={"left"}>
                {listAdss.map((adss, i) => {
                  return <Grid key={i} item xs={6} p={0}>
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
              sx={{
                height: "100%",
              }}
              xs={12}
              md={6}
              paddingBlock={1}
              paddingInline={0}
            >
              <Grid container m={0} p={0}>
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
              </Grid>
              <Grid item xs={12}>
                <MapContainer
                  center={[data.lat, data.lng]}
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
                  src={`${url}${data.image}`}
                  alt={"imagen"}
                  loading="lazy"
                />
              }
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEdit}>Cancelar</Button>
          <Button onClick={handleEditPoste}>Editar</Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
};
export default PosteSec;
