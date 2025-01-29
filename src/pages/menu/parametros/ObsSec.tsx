import {
  Autocomplete,
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
import AddObsDialog from "../../../components/dialogs/add/AddObsDialog";
import { ObsInterface, TipoObsInterface } from "../../../interfaces/interfaces";
import { useContext, useEffect, useState } from "react";
import { useSnackbar } from "notistack";
import { deleteObs, editObs, getObs } from "../../../api/Obs.api";
import { getTipoObs } from "../../../api/TipoObs.api";
import { SesionContext } from "../../../context/SesionProvider";
import { obsExample } from "../../../data/example";
import { DataGridPremium, GridColDef } from "@mui/x-data-grid-premium";

const columns: GridColDef[] = [
  {
    field: 'num', headerName: '#',
    renderCell: (params) => {
      // Usa `params.api.getRowIndexRelativeToVisibleRows` para obtener el índice
      const rowIndex = params.api.getRowIndexRelativeToVisibleRows(params.id);
      return <span>{rowIndex + 1}</span>;
    },
  },
  { field: 'id', headerName: 'Id' },
  { field: 'name', headerName: 'Nombre' },
  { field: 'description', headerName: 'Descripción' },
  { field: 'id_tipoObs', headerName: 'Tpo de observación' },
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

const ObsSec = () => {
  const [cargando, setCargando] = useState(false);

  const [open, setOpen] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [listTipoObs, setListTipoObs] = useState<TipoObsInterface[]>([]);
  //const [tipoObs, setTipoObs] = useState<TipoObsInterface>();

  const [data, setData] = useState<ObsInterface>(obsExample);
  const [list, setList] = useState<ObsInterface[]>();
  const { enqueueSnackbar } = useSnackbar();
  const { sesion } = useContext(SesionContext);

  useEffect(() => {
    recibirDatos()
  }, [open, openDelete])

  const recibirDatosTipoObs = async () => {
    setListTipoObs(await getTipoObs(sesion.token))
  }

  const recibirDatos = async () => {
    setList(await getObs(sesion.token))



  }


  const handleClickOpen = (rows: ObsInterface) => {
    setData(rows);
    recibirDatosTipoObs();
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
      const reponse = await editObs(data, sesion.token);
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
    const reponse = await deleteObs(data.id as number, sesion.token);
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
            Observación
          </Typography>

          {sesion.usuario.id_rol === 1 ? <>
            <ButtonGroup >
              <AddObsDialog functionApp={recibirDatos} />
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
      </> : <Grid sx={{ alignItems: "center", justifyContent: "center", display: "flex", height: "100%" }}> <CircularProgress /> </Grid>}

      {sesion.usuario.id_rol === 1 ? <>

        <Dialog
          fullWidth
          open={open}
          onClose={handleClose}
        >
          <DialogTitle>{"Editar Observación"}</DialogTitle>
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
                    const newData: ObsInterface = { ...data, name: event.target.value };
                    setData(newData)
                  }}
                />
              </Grid>
              <Grid item xs={12} md={7}>

                <Autocomplete
                  renderOption={(props, option) => {
                    return (
                      <li {...props} key={option.id}>
                        {option.name}
                      </li>
                    );
                  }}
                  disablePortal
                  options={listTipoObs}
                  getOptionLabel={(option) => option.name}
                  value={listTipoObs.find(tipoObs => tipoObs.id === data.id_tipoObs) || null}
                  onChange={(_event, newValue) => {
                    const newData: ObsInterface = { ...data, id_tipoObs: newValue?.id || 0 };
                    setData(newData)
                  }}
                  renderInput={(params) => <TextField {...params} label="Tipo de Observación" />}
                />
              </Grid>
              <Grid item xs={12} md={12}>
                <TextField
                  fullWidth
                  style={{
                    padding: 0,
                    margin: 0,
                  }}
                  label="Descripción"
                  value={data.description}
                  onChange={(event) => {
                    const newData: ObsInterface = { ...data, description: event.target.value };
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
          <DialogTitle>{"Eliminar Obs"}</DialogTitle>
          <DialogContent>
            <Grid container width={1} m={0}>
              Seguro que quiere eliminar este Obs?
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

export default ObsSec;
