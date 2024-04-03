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
import AddAdssDialog from "../../../components/dialogs/add/AddAdssDialog";
import { AdssInterface } from "../../../interfaces/interfaces";
import { useContext, useEffect, useState } from "react";
import { deleteAdss, editAdss, getAdss } from "../../../api/Adss.api";
import { useSnackbar } from "notistack";
import { SesionContext } from "../../../context/SesionProvider";
import { DataGridPremium, GridColDef } from "@mui/x-data-grid-premium";

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
  },
];

const AdssSec = () => {

  const [open, setOpen] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);

  const [data, setData] = useState<AdssInterface>({ id: 1, name: "", description: "" });
  const [list, setList] = useState<AdssInterface[]>();
  const { enqueueSnackbar } = useSnackbar();

  const { sesion } = useContext(SesionContext);


  useEffect(() => {
    recibirDatos()
  }, [open])


  const recibirDatos = async () => {
    setList(await getAdss(sesion.token))
  }


  const handleClickOpen = (rows: AdssInterface) => {
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
          Adss
        </Typography>
        <ButtonGroup >
          <AddAdssDialog functionApp={recibirDatos} />

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
              md: "calc(66vw - 80px )",
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
        <DialogTitle>{"Editar Adss"}</DialogTitle>
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
                  const newData: AdssInterface = { ...data, name: event.target.value };
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
                  const newData: AdssInterface = { ...data, description: event.target.value };
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
              if (data.name != '' && data.description != '') {
                const reponse = await editAdss(data, sesion.token);
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
        <DialogTitle>{"Eliminar Adss"}</DialogTitle>
        <DialogContent>
          <Grid container width={1} m={0}>
            Seguro que quiere eliminar este Adss?
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDelete}>Cancelar</Button>
          <Button onClick={async () => {
            const reponse = await deleteAdss(data.id as number, sesion.token);
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

export default AdssSec;
