import {
    Button,
    ButtonGroup,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    TextField,
} from "@mui/material";
import React from "react";
import { Add } from "@mui/icons-material";
import { AdssInterface } from "../../../interfaces/interfaces";
import { useSnackbar } from "notistack";
import { createAdss } from "../../../api/Adss.api";

interface AddAdssDialogProps {
    functionApp: () => void;
}



const AddAdssDialog: React.FC<AddAdssDialogProps> = ({ functionApp }) => {

    const [open, setOpen] = React.useState(false);
    const [data, setData] = React.useState<AdssInterface>({ description: "", name: "" });
    const { enqueueSnackbar } = useSnackbar();

    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setData({ description: "", name: "" })
        setOpen(false);
        functionApp();
    };

    return (
        <React.Fragment>
            <Button startIcon={<Add />} variant="outlined" onClick={handleClickOpen}>
                {"Nuevo Adss"}
            </Button>
            <Dialog
                fullWidth
                open={open}
                onClose={handleClose}
            >
                <DialogTitle>{"Insertar nuevo adss"}</DialogTitle>
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
                                    const newData: AdssInterface = { ...data, name: event.target.value };
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
                                    const newData: AdssInterface = { ...data, description: event.target.value };
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
                            if (data.name != '' && data.description != '') {
                                const reponse = await createAdss(data);

                                if (Number(reponse) === 200) {
                                    enqueueSnackbar("Introducido con exito", {
                                        variant: "success",
                                    });
                                    handleClose()
                                }
                                else {
                                    enqueueSnackbar("No se pudo introducir los datos", {
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


export default AddAdssDialog;
