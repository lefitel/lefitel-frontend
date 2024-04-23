import {
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
import { TipoObsInterface } from "../../../interfaces/interfaces";
import { useSnackbar } from "notistack";
import { createTipoObs } from "../../../api/TipoObs.api";
import { SesionContext } from "../../../context/SesionProvider";

interface AddTipoObsDialogProps {
    functionApp: () => void;
}

const AddTipoObsDialog: React.FC<AddTipoObsDialogProps> = ({ functionApp }) => {
    const [open, setOpen] = useState(false);
    const [cargando, setCargando] = useState(false);

    const [data, setData] = useState<TipoObsInterface>({ id: 0, description: "", name: "" });
    const { enqueueSnackbar } = useSnackbar();
    const { sesion } = useContext(SesionContext);

    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setData({ id: 0, description: "", name: "" })
        setOpen(false);
        functionApp()
    };

    const handleGuardar = async () => {
        setCargando(true)
        if (data.name != '' && data.description != '') {
            const reponse = await createTipoObs(data, sesion.token);

            if (Number(reponse) === 200) {
                setCargando(false)
                enqueueSnackbar("Introducido con exito", {
                    variant: "success",
                });
                handleClose()
            }
            else {
                setCargando(false)
                enqueueSnackbar("No se pudo introducir los datos", {
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
                {"Nuevo Tipo de Obs."}
            </Button>
            <Dialog
                fullWidth
                open={open}
                onClose={handleClose}
            >
                <DialogTitle>{"Insertar nuevo Tipo de Observación"}</DialogTitle>
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
                                    const newData: TipoObsInterface = { ...data, name: event.target.value };
                                    setData(newData)
                                }}
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
                                onChange={(event) => {
                                    const newData: TipoObsInterface = { ...data, description: event.target.value };
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


export default AddTipoObsDialog;
