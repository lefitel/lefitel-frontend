import {
  Box,
  Button,
  ButtonGroup,
  Card,
  CardActions,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import AddCiudadDialog from "../../../components/dialogs/add/AddCiudadDialog";
import { CiudadInterface } from "../../../interfaces/interfaces";
import { useContext, useEffect, useState } from "react";
import { deleteCiudad, editCiudad, getCiudad } from "../../../api/Ciudad.api";
import { useSnackbar } from "notistack";
import { MapContainer, Marker, Popup, TileLayer, useMapEvent } from "react-leaflet";
import { latExample, lngExample } from "../../../data/example";
import { SesionContext } from "../../../context/SesionProvider";

const columns = [
  { field: 'id', headerName: 'Id', width: 15 },
  { field: 'name', headerName: 'Nombre', width: 150 },
  { field: 'lat', headerName: 'Latitud', width: 150 },
  { field: 'lng', headerName: 'Longitud', width: 150 },
  {
    field: 'createdAt', headerName: 'Creación', width: 150,
    valueGetter: ({ value }: { value: string }) => {
      const date = new Date(value);
      return date.toLocaleString();
    }
  },
  {
    field: 'updatedAt', headerName: 'Edición', width: 150,
    valueGetter: ({ value }: { value: string }) => {
      const date = new Date(value);
      return date.toLocaleString();
    }
  },
];
const CiudadSec = () => {
  const [open, setOpen] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [data, setData] = useState<CiudadInterface>({ id: 1, name: "", lat: latExample, lng: lngExample });
  const [list, setList] = useState<CiudadInterface[]>();
  const { enqueueSnackbar } = useSnackbar();
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
  };
  const handleClickOpenDelete = () => {
    setOpenDelete(true);
  };

  const handleCloseDelete = () => {
    setOpenDelete(false);
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
  return (
    <Card sx={{ flex: 1 }}>
      <CardContent>
        <CardActions
          style={{
            paddingInline: 0,
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
          <ButtonGroup
            size="small"
            variant="outlined"
            aria-label="outlined primary button group"
          >
            <AddCiudadDialog functionApp={recibirDatos} />

          </ButtonGroup>
        </CardActions>
        <Box
          sx={{
            height: {
              xs: "250px",
            },
            width: {
              xs: "calc(100vw - 100px )",
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
      <Dialog
        fullWidth
        open={open}
        onClose={handleClose}
      >
        <DialogTitle>{"Editar Ciudad"}</DialogTitle>
        <DialogContent>
          <Grid container width={1} m={0}>
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
            <Grid item xs={12} md={12}>
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
        </DialogContent>
        <DialogActions style={{
          display: "flex",
          justifyContent: "space-between"
        }}>
          <Grid>
            <Button variant="outlined" onClick={handleClickOpenDelete}>
              {"Elimnar"}
            </Button>

          </Grid>
          <ButtonGroup>
            <Button onClick={handleClose}>Cancelar</Button>
            <Button onClick={async () => {
              if (data.name != '') {
                const reponse = await editCiudad(data, sesion.token);
                if (Number(reponse) === 200) {
                  enqueueSnackbar("Editado con exito", {
                    variant: "success",
                  });
                  handleClose()
                }
                else {
                  enqueueSnackbar("No se pudo editar los datos", {
                    variant: "error",
                  });
                }
              }
              else {
                enqueueSnackbar("Rellena todos los espacios", {
                  variant: "warning",
                });
              }
            }}>Guardar</Button>
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
          <Button onClick={async () => {
            const reponse = await deleteCiudad(data.id as number, sesion.token);
            if (Number(reponse) === 200) {
              enqueueSnackbar("Eliminado con exito", {
                variant: "success",
              });
              handleCloseDelete()
              handleClose()
            }
            else {
              enqueueSnackbar("No se pudo Eliminar", {
                variant: "error",
              });
            }
          }}>Eliminar</Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default CiudadSec;
