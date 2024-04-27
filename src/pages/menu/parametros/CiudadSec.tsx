import {
  Box,
  Button,
  ButtonGroup,
  Card,
  CardActions,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Input,
  TextField,
  Typography,
} from "@mui/material";
import AddCiudadDialog from "../../../components/dialogs/add/AddCiudadDialog";
import { CiudadInterface } from "../../../interfaces/interfaces";
import { useContext, useEffect, useState } from "react";
import { deleteCiudad, editCiudad, getCiudad } from "../../../api/Ciudad.api";
import { useSnackbar } from "notistack";
import { MapContainer, Marker, Popup, TileLayer, useMapEvent } from "react-leaflet";
import { ciudadExample } from "../../../data/example";
import { SesionContext } from "../../../context/SesionProvider";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { url } from "../../../api/url";
import { uploadImage } from "../../../api/Upload.api";

const columns: GridColDef[] = [
  { field: 'id', headerName: 'Id' },
  { field: 'name', headerName: 'Nombre' },
  { field: 'lat', headerName: 'Latitud' },
  { field: 'lng', headerName: 'Longitud' },
  {
    field: 'image', headerName: 'Foto',
    renderCell: (params) => (<img src={`${url}${params.row.image}`} style={{ height: 100 }} />),
    valueGetter(_params, row) { return `${url}${row.image}` },
  },
  {
    field: 'createdAt', headerName: 'Creación', type: 'dateTime',
    valueGetter: (value) => {
      const date = new Date(value);
      return date;
    }
  },
  {
    field: 'updatedAt', headerName: 'Edición', type: 'dateTime',
    valueGetter: (value) => {
      const date = new Date(value);
      return date;
    }
  }
];
const CiudadSec = () => {
  const [cargando, setCargando] = useState(false);
  const [open, setOpen] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [data, setData] = useState<CiudadInterface>(ciudadExample);
  const [list, setList] = useState<CiudadInterface[]>();
  const { enqueueSnackbar } = useSnackbar();
  const [image, setImage] = useState<File | null>();

  const { sesion } = useContext(SesionContext);
  useEffect(() => {
    recibirDatos()
  }, [open])

  const recibirDatos = async () => {
    setList(await getCiudad(sesion.token))
  }

  const handleClickOpen = (rows: CiudadInterface) => {
    setData(rows);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setImage(null);
  };
  const handleClickOpenDelete = () => {
    setOpenDelete(true);
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

  function LocationMarker() {
    // @ts-expect-error No se sabe el tipo de event
    const map = useMapEvent('click', (event) => {
      const newData: CiudadInterface = { ...data, lat: event.latlng.lat, lng: event.latlng.lng };
      setData(newData)
      map.flyTo(event.latlng, map.getZoom())

    })


    return null
  }
  const handleEdit = async () => {

    setCargando(true)
    if (data.name != '') {

      let newData: CiudadInterface = { ...data }
      if (image) {
        const reponseUpload = await uploadImage(image, sesion.token);
        if (reponseUpload != "500") {
          newData = { ...newData, image: reponseUpload };
        }
        else {
          setCargando(false)
          enqueueSnackbar("No se pudo Ingresar la imagen", {
            variant: "error",
          });
        }
      }

      const reponse = await editCiudad(newData, sesion.token);
      if (Number(reponse) === 200) {
        setCargando(false)
        enqueueSnackbar("Editado con exito", {
          variant: "success",
        });
        handleClose()
      }
      else {
        setCargando(false)
        enqueueSnackbar("No se pudo editar los datos", {
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
    const reponse = await deleteCiudad(data.id as number, sesion.token);
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
  return (
    <Card sx={{ flex: 1 }}>
      {list ? <>

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
            Ciudad
          </Typography>

          {sesion.usuario.id_rol === 1 ? <>
            <ButtonGroup >
              <AddCiudadDialog functionApp={recibirDatos} />
            </ButtonGroup>
          </> : null}

        </CardActions>
        <CardContent>

          <Box
            sx={{
              height: {
                xs: "250px",
              },
              width: {
                xs: "calc(100vw - 110px )",
                sm: "calc(100vw - 115px )",
                md: "calc(66vw - 80px )",
              },
            }}
          >
            <DataGrid
              //className="datagrid-content"
              rows={list ? list : []}
              columns={columns}
              hideFooterPagination
              rowHeight={38}
              disableRowSelectionOnClick
              onRowClick={(params) => {
                handleClickOpen(params.row);
              }}
              hideFooter
            />
          </Box>
        </CardContent>
      </> : <Grid sx={{ alignItems: "center", justifyContent: "center", display: "flex", height: "100%" }}> <CircularProgress /> </Grid>}

      {sesion.usuario.id_rol === 1 ? <>

        <Dialog
          fullWidth
          open={open}
          onClose={handleClose}
        >
          <DialogTitle>{"Editar Ciudad"}</DialogTitle>
          <DialogContent>
            <Grid container width={1}>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  disabled
                  style={{
                    padding: 0,
                    margin: 0,
                  }}
                  label="Id"
                  value={data.id}
                />
              </Grid>
              <Grid item xs={12} md={9}>
                <TextField
                  fullWidth
                  style={{
                    padding: 0,
                    margin: 0,
                  }}
                  label="Nombre"
                  value={data.name}
                  onChange={(event) => {
                    const newData: CiudadInterface = { ...data, name: event.target.value };
                    setData(newData)
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6} sx={{ p: 0 }}>
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
                    <Grid item xs={6}>
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
                          const newData: CiudadInterface = { ...data, lat: parseFloat(event.target.value) };
                          setData(newData)
                        }}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Longitud"
                        value={data.lng}
                        onChange={(event) => {
                          const newData: CiudadInterface = { ...data, lng: parseFloat(event.target.value) };
                          setData(newData)
                        }}
                      />
                    </Grid>
                  </Grid>
                </Grid>
                <Grid>
                  {/* @ts-expect-error No se sabe el tipo de event*/}
                  <MapContainer center={[data.lat, data.lng]}
                    zoom={13}
                    style={{ height: "200px" }}
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
                sx={{ p: 0 }}
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
              <Button onClick={handleEdit}>Guardar</Button>
            </ButtonGroup>
          </DialogActions>
        </Dialog>
        <Dialog
          open={openDelete}
          onClose={handleCloseDelete}
        >
          <DialogTitle>{"Eliminar Ciudad"}</DialogTitle>
          <DialogContent>
            <Grid container width={1} m={0}>
              Seguro que quiere eliminar este Ciudad?
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDelete}>Cancelar</Button>
            <Button onClick={handleDelete}>Eliminar</Button>
          </DialogActions>
        </Dialog>
      </> : null}

      {cargando && (
        <Box sx={{ height: "100vh", width: "100vw", top: 0, left: 0, alignContent: "center", backgroundColor: 'rgba(0, 0, 0, 0.25)', position: "fixed", zIndex: "1301" }} >
          <CircularProgress sx={{ color: "white" }} />
        </Box>
      )}
    </Card>
  );
};

export default CiudadSec;
