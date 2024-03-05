import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  AppBar,
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  Input,
  LinearProgress,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { ArrowDropDown, Close } from "@mui/icons-material";
import EditEventoDialog from "../../../../components/dialogs/edits/EditEventoDialog";
import { EventoInterface, EventoObsInterface, ObsInterface, RevicionInterface, TipoObsInterface } from "../../../../interfaces/interfaces";
import { getEvento } from "../../../../api/Evento.api";
import { DatePicker } from "@mui/x-date-pickers";
import { url } from "../../../../api/url";
import { eventoExample, revicionExample } from "../../../../data/example";
import { getRevicion } from "../../../../api/Revicion.api";
import dayjs from "dayjs";
import { getObs } from "../../../../api/Obs.api";
import { getTipoObs } from "../../../../api/TipoObs.api";
import { getEventoObs } from "../../../../api/EventoObs.api";

const columns = [
  { field: 'id', headerName: 'Id', width: 15 },
  { field: 'description', headerName: 'Descripción', width: 150 },
  { field: 'state', headerName: 'Estado', width: 100 },

];

interface PosteDetalleEventoSecProps {
  posteId: number;
}

const PosteDetalleEventoSec: React.FC<PosteDetalleEventoSecProps> = ({ posteId }) => {
  const [openDelete, setOpenDelete] = useState(false);

  const [open, setOpen] = useState(false);
  const [list, setList] = useState<EventoInterface[]>();
  const [image, setImage] = useState<File | null>();
  const [data, setData] = React.useState<EventoInterface>(eventoExample);
  const [dataRevicion, setDataRevicion] = React.useState<RevicionInterface[]>([]);

  const [listObs, setListObs] = React.useState<ObsInterface[]>([]);
  const [listTipoObs, setListTipoObs] = React.useState<TipoObsInterface[]>([]);
  const [listObsSelected, setListObsSelected] = React.useState<number[]>([]);
  const [listEventoObs, setListEventoObs] = React.useState<EventoObsInterface[]>([]);

  useEffect(() => {
    recibirDatos()
  }, [posteId])

  useEffect(() => {
    if (data.id) {
      recibirDatosEdicion(data)
    }
  }, [open])

  const recibirDatos = async () => {
    setList(await getEvento(posteId))
    setListObs(await getObs())
    setListTipoObs(await getTipoObs())

  }

  const recibirDatosEdicion = async (evento: EventoInterface) => {

    const eventoObsTemp = await getEventoObs(evento.id as number)
    setListEventoObs(eventoObsTemp)

    const ids = await eventoObsTemp.map(objeto => objeto.id) ? listEventoObs.map(objeto => objeto.id_obs) : [];
    console.log(eventoObsTemp)
    setListObsSelected(ids)


    setDataRevicion(await getRevicion(evento.id as number))

  }


  const handleClickOpen = (rows: EventoInterface) => {
    //recibirDatosEdicion(rows)
    setData(rows);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    recibirDatos();

    setListObsSelected([]);

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
  return (
    <Box
      sx={{
        height: {
          xs: "calc(100vh - 210px)",
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
          handleClickOpen(params.row);
        }}
        hideFooter
      />
      <Dialog
        fullWidth
        open={open}
        onClose={handleClose}
      >
        <DialogTitle>{"Editar Evento"}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            <Grid container width={1} m={0}>
              <Grid item xs={12} md={4}>
                <TextField
                  disabled
                  fullWidth
                  style={{
                    padding: 0,
                    margin: 0,
                  }}
                  label="Numero de poste"
                  value={data.id}

                />
              </Grid>

              <Grid item xs={12} md={8}>
                <TextField
                  fullWidth
                  multiline
                  style={{
                    padding: 0,
                    margin: 0,
                  }}
                  label="Descripción"
                  value={data.description}

                />
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
                  <Grid item xs={12} paddingInline={0} paddingBlock={1}>
                    <Typography
                      display={"flex"}
                      color="text.secondary"
                      textAlign={"left"}
                      paddingInline={1}
                      pb={0}
                    >
                      Observaciones:
                    </Typography>
                  </Grid>
                  {
                    listTipoObs.map((tipoObs, i) =>
                    (
                      <Grid key={i} item xs={12}>
                        <Accordion sx={{ width: 1 }} variant="outlined">
                          <AccordionSummary expandIcon={<ArrowDropDown />}>
                            <Typography>{tipoObs.name}</Typography>
                          </AccordionSummary>
                          <AccordionDetails
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              textAlign: "left",
                              padding: "4px",
                              margin: "0px",
                            }}
                          >
                            {listObs.map(
                              (obs, i) => {
                                if (obs.id_tipoObs === tipoObs.id) {
                                  return <Grid key={i} item xs={6} p={0}>
                                    <FormControlLabel
                                      control={<Checkbox
                                        checked={listObsSelected?.some(objeto => objeto === obs.id)}

                                        onChange={(event) => {
                                          console.log()
                                          if (event.target.checked) {
                                            setListObsSelected(prevLista => [...prevLista, tipoObs.id ? tipoObs.id : 0])
                                          }
                                          else {
                                            const nuevaLista = listObsSelected.filter(item => item !== tipoObs.id);
                                            //console.log(nuevaLista)
                                            setListObsSelected(nuevaLista);
                                          }
                                        }}
                                      />}
                                      sx={{
                                        margin: 0,
                                      }}
                                      label={obs.name}

                                    />
                                  </Grid>
                                }
                                else {
                                  return null
                                }
                              }


                            )}

                          </AccordionDetails>
                        </Accordion></Grid>)
                    )
                  }


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
              <Grid item xs={12}>
                <Typography> Reviciones</Typography>
              </Grid>
              {
                dataRevicion.map((item, i) =>
                  <Grid key={i} container item xs={12}>
                    <Grid item xs={12} md={6}>
                      <DatePicker
                        sx={{ width: 1 }}

                        label="Fecha de revición"
                        format="DD-MM-YYYY"
                        defaultValue={dayjs(item.date)}
                        onChange={(date) => {
                          if (date) {
                            const newListObjetos = [...dataRevicion];
                            const objetoEditado: RevicionInterface = newListObjetos.find(objeto => objeto.id === item.id) as RevicionInterface;
                            objetoEditado.date = date.toDate();
                            setDataRevicion(newListObjetos);
                          }
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        multiline
                        style={{
                          padding: 0,
                          margin: 0,
                        }}
                        label="Descripción de revición"
                        value={item.description}
                        onChange={(event) => {

                          const newListObjetos = [...dataRevicion];
                          const objetoEditado: RevicionInterface = newListObjetos.find(objeto => objeto.id === item.id) as RevicionInterface;
                          objetoEditado.description = event.target.value;
                          setDataRevicion(newListObjetos);

                        }}
                      />
                    </Grid>
                  </Grid>
                )
              }


            </Grid>
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <ButtonGroup>
            <Button onClick={handleClose}>Cancelar</Button>
            <Button onClick={() => { }}>Añadir revisión</Button>
            <Button
              onClick={() => {
              }}
            >
              Solucionar
            </Button>

            <Button onClick={() => { }}>Guardar</Button>
          </ButtonGroup>

        </DialogActions>

      </Dialog>
    </Box>
  );
};

export default PosteDetalleEventoSec;
