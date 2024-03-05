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
import { Add } from "@mui/icons-material";
import { DataGrid } from "@mui/x-data-grid";
import AddTipoObsDialog from "../../../components/dialogs/add/AddTipoObsDialog";
import { TipoObsInterface } from "../../../interfaces/interfaces";
import { useContext, useEffect, useState } from "react";
import { useSnackbar } from "notistack";
import { deleteTipoObs, editTipoObs, getTipoObs } from "../../../api/TipoObs.api";
import { SesionContext } from "../../../context/SesionProvider";

const columns = [
  { field: 'id', headerName: 'Id', width: 15 },
  { field: 'name', headerName: 'Nombre', width: 100 },
  { field: 'description', headerName: 'Descripción', width: 150 },
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
const TipoObsSec = () => {

  const [open, setOpen] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [data, setData] = useState<TipoObsInterface>({ id: 1, name: "", description: "" });
  const [list, setList] = useState<TipoObsInterface[]>();
  const { enqueueSnackbar } = useSnackbar();
  const { sesion } = useContext(SesionContext);

  useEffect(() => {
    recibirDatos()
  }, [open])


  const recibirDatos = async () => {
    setList(await getTipoObs(sesion.token))



  }


  const handleClickOpen = (rows: TipoObsInterface) => {
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
            Tipo de Observación
          </Typography>
          <ButtonGroup
            size="small"
            variant="outlined"
            aria-label="outlined primary button group"
          >
            <AddTipoObsDialog functionApp={recibirDatos} />

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
              md: "calc(33vw - 61px )",

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
        <DialogTitle>{"Editar Tipo de Observación"}</DialogTitle>
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
                  const newData: TipoObsInterface = { ...data, name: event.target.value };
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
                  const newData: TipoObsInterface = { ...data, description: event.target.value };
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
            <Button variant="outlined" onClick={handleClickOpenDelete}>
              {"Elimnar"}
            </Button>

          </Grid>
          <ButtonGroup>
            <Button onClick={handleClose}>Cancelar</Button>
            <Button onClick={async () => {
              if (data.name != '' && data.description != '') {
                const reponse = await editTipoObs(data, sesion.token);
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
        <DialogTitle>{"Eliminar TipoObs"}</DialogTitle>
        <DialogContent>
          <Grid container width={1} m={0}>
            Seguro que quiere eliminar este TipoObs?
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDelete}>Cancelar</Button>
          <Button onClick={async () => {
            const reponse = await deleteTipoObs(data.id as number, sesion.token);
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

export default TipoObsSec;
