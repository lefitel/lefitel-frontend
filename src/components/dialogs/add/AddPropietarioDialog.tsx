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
import { PropietarioInterface } from "../../../interfaces/interfaces";
import { useSnackbar } from "notistack";
import { createPropietario } from "../../../api/Propietario.api";
import { SesionContext } from "../../../context/SesionProvider";

interface AddPropietarioDialogProps {
    functionApp: () => void;
}


const AddPropietarioDialog: React.FC<AddPropietarioDialogProps> = ({ functionApp }) => {
    const [cargando, setCargando] = useState(false);

    const [open, setOpen] = useState(false);
    const [data, setData] = useState<PropietarioInterface>({ id: 0, name: "" });
    const { enqueueSnackbar } = useSnackbar();
    const { sesion } = useContext(SesionContext);

    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setData({ id: 0, name: "" })
        setOpen(false);
        functionApp()
    };

    const handleGuardar = async () => {
        setCargando(true)
        if (data.name != '') {
            const reponse = await createPropietario(data, sesion.token);

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
                {"Nuevo Propietario"}
            </Button>
            <Dialog
                fullWidth
                open={open}
                onClose={handleClose}
            >
                <DialogTitle>{"Insertar nuevo Propietario"}</DialogTitle>
                <DialogContent>
                    <Grid container width={1} m={0}>
                        <Grid item xs={12} md={12}>
                            <TextField
                                fullWidth
                                style={{
                                    padding: 0,
                                    margin: 0,
                                }}
                                label="Nombre"
                                onChange={(event) => {
                                    const newData: PropietarioInterface = { ...data, name: event.target.value };
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


export default AddPropietarioDialog;
