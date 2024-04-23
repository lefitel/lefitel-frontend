import {
    Autocomplete,
    Box,
    Button,
    ButtonGroup,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    TextField,
} from "@mui/material";
import React, { useContext, useState } from "react";
import { Add } from "@mui/icons-material";
import { ObsInterface, TipoObsInterface } from "../../../interfaces/interfaces";
import { useSnackbar } from "notistack";
import { createObs } from "../../../api/Obs.api";
import { getTipoObs } from "../../../api/TipoObs.api";
import { obsExample } from "../../../data/example";
import { SesionContext } from "../../../context/SesionProvider";

interface AddObsDialogProps {
    functionApp: () => void;
}

const AddObsDialog: React.FC<AddObsDialogProps> = ({ functionApp }) => {
    const [open, setOpen] = useState(false);
    const [cargando, setCargando] = useState(false);

    const [listTipoData, setListTipoData] = useState<TipoObsInterface[]>([]);
    const [data, setData] = useState<ObsInterface>(obsExample);
    const { enqueueSnackbar } = useSnackbar();
    const { sesion } = useContext(SesionContext);
    const recibirDatos = async () => {
        setCargando(true)
        setListTipoData(await getTipoObs(sesion.token))
        await setCargando(false)
    }
    const handleClickOpen = () => {
        recibirDatos()
        setOpen(true);
    };
    const handleClose = () => {
        setData(obsExample)
        setOpen(false);
        functionApp()
    };

    const handleGuardar = async () => {
        setCargando(true)
        if (data.name != '' && data.description != '' && data.id_tipoObs != 0) {
            const reponse = await createObs(data, sesion.token);

            if (Number(reponse) === 200) {
                setCargando(false)
                enqueueSnackbar("Ingresado con exito", {
                    variant: "success",
                });
                handleClose()
            }
            else {
                setCargando(false)
                enqueueSnackbar("No se pudo Ingresar", {
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

    return (
        <React.Fragment>
            <Button startIcon={<Add />} onClick={handleClickOpen}>
                {"Nueva Observación"}
            </Button>
            <Dialog
                fullWidth
                open={open}
                onClose={handleClose}
            >
                <DialogTitle>{"Insertar nueva Observación"}</DialogTitle>
                <DialogContent>
                    <Grid container width={1} m={0}>
                        <Grid item xs={12} md={4}>
                            <TextField
                                fullWidth
                                style={{
                                    padding: 0,
                                    margin: 0,
                                }}
                                label="Nombre"
                                onChange={(event) => {
                                    const newData: ObsInterface = { ...data, name: event.target.value };
                                    setData(newData)
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} md={8}>
                            <Autocomplete
                                renderOption={(props, option) => {
                                    return (
                                        <li {...props} key={option.id}>
                                            {option.name}
                                        </li>
                                    );
                                }}
                                disablePortal
                                options={listTipoData}
                                getOptionLabel={(option) => option.name}
                                onChange={(_event, newValue) => {
                                    const newData: ObsInterface = { ...data, id_tipoObs: newValue?.id ? newValue?.id : 0 };
                                    setData(newData)
                                }}
                                renderInput={(params) => <TextField {...params} label="Tipo de Observación" />}
                            />
                        </Grid>
                        <Grid item xs={12} md={12}>
                            <TextField
                                fullWidth
                                multiline
                                style={{
                                    padding: 0,
                                    margin: 0,
                                }}
                                label="Descripción"
                                onChange={(event) => {
                                    const newData: ObsInterface = { ...data, description: event.target.value };
                                    setData(newData)
                                }}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <ButtonGroup>
                        <Button onClick={handleClose}>Cancelar</Button>
                        <Button onClick={handleGuardar}>Guardar</Button>
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


export default AddObsDialog;
