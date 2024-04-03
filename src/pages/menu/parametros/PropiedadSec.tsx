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
import AddPropietarioDialog from "../../../components/dialogs/add/AddPropietarioDialog";
import { PropietarioInterface } from "../../../interfaces/interfaces";
import { useContext, useEffect, useState } from "react";
import { useSnackbar } from "notistack";
import { deletePropietario, editPropietario, getPropietario } from "../../../api/Propietario.api";
import { SesionContext } from "../../../context/SesionProvider";
import { DataGridPremium, GridColDef } from "@mui/x-data-grid-premium";

const columns: GridColDef[] = [
  { field: 'id', headerName: 'Id' },
  { field: 'name', headerName: 'Nombre' },
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
const PropietarioSec = () => {
  const [open, setOpen] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [data, setData] = useState<PropietarioInterface>({ id: 1, name: "" });
  const [list, setList] = useState<PropietarioInterface[]>();
  const { enqueueSnackbar } = useSnackbar();
  const { sesion } = useContext(SesionContext);
  useEffect(() => {
    recibirDatos()
  }, [open])

  const recibirDatos = async () => {
    setList(await getPropietario(sesion.token))
  }

  const handleClickOpen = (rows: PropietarioInterface) => {
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
          Propietario
        </Typography>
        <ButtonGroup >
          <AddPropietarioDialog functionApp={recibirDatos} />
        </ButtonGroup>
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
          <DataGridPremium
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
        <DialogTitle>{"Editar Propietario"}</DialogTitle>
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
            <Grid item xs={12} md={10}>
              <TextField
                fullWidth
                style={{
                  padding: 0,
                  margin: 0,
                }}
                label="Nombre"
                value={data.name}
                onChange={(event) => {
                  const newData: PropietarioInterface = { ...data, name: event.target.value };
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
              {"Elimnar"}
            </Button>
          </Grid>
          <ButtonGroup>
            <Button onClick={handleClose}>Cancelar</Button>
            <Button onClick={async () => {
              if (data.name != '') {
                const reponse = await editPropietario(data, sesion.token);
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
        <DialogTitle>{"Eliminar Propietario"}</DialogTitle>
        <DialogContent>
          <Grid container width={1} m={0}>
            Seguro que quiere eliminar este Propietario?
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDelete}>Cancelar</Button>
          <Button onClick={async () => {
            const reponse = await deletePropietario(data.id as number, sesion.token);
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

export default PropietarioSec;
