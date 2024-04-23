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
  TextField,
  Typography,
} from "@mui/material";
import AddMaterialDialog from "../../../components/dialogs/add/AddMaterialDialog";
import { MaterialInterface } from "../../../interfaces/interfaces";
import { useContext, useEffect, useState } from "react";
import { deleteMaterial, editMaterial, getMaterial } from "../../../api/Material.api";
import { useSnackbar } from "notistack";
import { SesionContext } from "../../../context/SesionProvider";
import { DataGrid, GridColDef } from "@mui/x-data-grid";

const columns: GridColDef[] = [
  { field: 'id', headerName: 'Id' },
  { field: 'name', headerName: 'Nombre' },
  { field: 'description', headerName: 'Descripción' },
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
const MaterialSec = () => {
  const [cargando, setCargando] = useState(false);

  const [open, setOpen] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  const [data, setData] = useState<MaterialInterface>({ id: 1, name: "", description: "" });
  const [list, setList] = useState<MaterialInterface[]>();
  const { enqueueSnackbar } = useSnackbar();
  const { sesion } = useContext(SesionContext);

  useEffect(() => {
    recibirDatos()
  }, [open])


  const recibirDatos = async () => {
    setList(await getMaterial(sesion.token))

  }

  const handleClickOpen = (rows: MaterialInterface) => {
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
  const handleEdit = async () => {
    setCargando(true)
    if (data.name != '' && data.description != '') {
      const reponse = await editMaterial(data, sesion.token);
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
    const reponse = await deleteMaterial(data.id as number, sesion.token);
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
          Material
        </Typography>
        {sesion.usuario.id_rol === 1 ? <>
          <ButtonGroup >
            <AddMaterialDialog functionApp={recibirDatos} />
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
              md: "calc(33vw - 61px )",
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
      {sesion.usuario.id_rol === 1 ? <>

        <Dialog
          fullWidth
          open={open}
          onClose={handleClose}
        >
          <DialogTitle>{"Editar Material"}</DialogTitle>
          <DialogContent>
            <Grid container width={1} m={0}>
              <Grid item xs={12} md={2}>
                <TextField

                  fullWidth disabled
                  style={{
                    padding: 0,
                    margin: 0,
                  }}
                  label="Id"
                  value={data.id}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  style={{
                    padding: 0,
                    margin: 0,
                  }}
                  label="Nombre"
                  value={data.name}
                  onChange={(event) => {
                    const newData: MaterialInterface = { ...data, name: event.target.value };
                    setData(newData)
                  }}
                />
              </Grid>
              <Grid item xs={12} md={7}>
                <TextField
                  fullWidth
                  style={{
                    padding: 0,
                    margin: 0,
                  }}
                  label="Descripción"
                  value={data.description}
                  onChange={(event) => {
                    const newData: MaterialInterface = { ...data, description: event.target.value };
                    setData(newData)
                  }}
                />
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
          <DialogTitle>{"Eliminar Material"}</DialogTitle>
          <DialogContent>
            <Grid container width={1} m={0}>
              Seguro que quiere eliminar este Material?
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

export default MaterialSec;
