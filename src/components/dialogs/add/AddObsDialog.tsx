import {
    Autocomplete,
    Button,
    ButtonGroup,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    TextField,
} from "@mui/material";
import React, { useContext } from "react";
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
    const [open, setOpen] = React.useState(false);
    const [listTipoData, setListTipoData] = React.useState<TipoObsInterface[]>([]);
    const [data, setData] = React.useState<ObsInterface>(obsExample);
    const { enqueueSnackbar } = useSnackbar();
    const { sesion } = useContext(SesionContext);
    const recibirDatos = async () => {
        setListTipoData(await getTipoObs(sesion.token))
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

    return (
        <React.Fragment>
            <Button startIcon={<Add />} variant="outlined" onClick={handleClickOpen}>
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
                                onChange={(event, newValue) => {
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
                        <Button onClick={async () => {
                            if (data.name != '' && data.description != '' && data.id_tipoObs != 0) {
                                const reponse = await createObs(data, sesion.token);

                                if (Number(reponse) === 200) {
                                    enqueueSnackbar("Ingresado con exito", {
                                        variant: "success",
                                    });
                                    handleClose()
                                }
                                else {
                                    enqueueSnackbar("No se pudo Ingresar", {
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
        </React.Fragment>
    );



};


export default AddObsDialog;
