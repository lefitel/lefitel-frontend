import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField } from '@mui/material';
import React, { useContext, useState } from 'react'
import { SesionContext } from '../../../context/SesionProvider';
import { UsuarioInterface } from '../../../interfaces/interfaces';
import { usuarioExample } from '../../../data/example';
import { enqueueSnackbar } from 'notistack';
import { editUserPass } from '../../../api/Usuario.api';
import { loginUsuario } from '../../../api/Login.api';

const EditUserPassDialog = () => {


    const [open, setOpen] = useState(false);
    const [data, setData] = useState<UsuarioInterface>(usuarioExample);
    const [newPass, setNewPass] = useState<string>("");
    const [confirmNewPass, setConfirmNewPass] = useState<string>("");

    const { sesion } = useContext(SesionContext);


    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setData(usuarioExample)
        setNewPass("")
        setConfirmNewPass("")
    };

    return (
        <React.Fragment>
            <Button onClick={handleClickOpen}>
                {"Editar Contraseña de Usuario"}
            </Button>
            <Dialog
                fullWidth
                open={open}
                onClose={handleClose}
            >
                <DialogTitle>{"Editar contraseña de usuario"}</DialogTitle>
                <DialogContent>
                    <Grid container width={1} m={0}>
                        <Grid item xs={12} md={12}>
                            <TextField
                                fullWidth
                                style={{
                                    padding: 0,
                                    margin: 0,
                                }}
                                label="Contraseña"
                                type='password'
                                value={data.pass}
                                onChange={(event) => {
                                    const newData: UsuarioInterface = { ...data, pass: event.target.value };
                                    setData(newData)
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                style={{
                                    padding: 0,
                                    margin: 0,
                                }}
                                label="Nueva Contraseña"
                                type='password'
                                value={newPass}
                                onChange={(event) => {
                                    setNewPass(event.target.value)
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                style={{
                                    padding: 0,
                                    margin: 0,
                                }}
                                label="Confirmar Contraseña"
                                type='password'
                                value={confirmNewPass}
                                onChange={(event) => {
                                    setConfirmNewPass(event.target.value)
                                }}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>Cancelar</Button>
                    <Button onClick={async () => {

                        console.log({ ...sesion.usuario, pass: data.pass })

                        const responde = await loginUsuario({ ...sesion.usuario, pass: data.pass });

                        if (responde.status != 500) {

                            if (newPass != '' && confirmNewPass != '' && data.pass != '') {


                                if (newPass === confirmNewPass) {
                                    const reponse = await editUserPass({ ...sesion.usuario, pass: newPass }, sesion.token);
                                    if (Number(reponse) === 200) {
                                        enqueueSnackbar("Editado con exito", {
                                            variant: "success",
                                        });
                                        handleClose()
                                    }
                                    else {
                                        enqueueSnackbar("No se pudo Editar", {
                                            variant: "error",
                                        });
                                    }
                                } else {
                                    enqueueSnackbar("Las contraseñas no coinciden", {
                                        variant: "warning",
                                    });
                                }

                            } else {
                                enqueueSnackbar("Rellena todos los espacios", {
                                    variant: "warning",
                                });
                            }
                        } else {
                            enqueueSnackbar(responde.message, {
                                variant: "error",
                            });
                        }


                    }}>Guardar</Button>
                </DialogActions>
            </Dialog>
        </React.Fragment>
    )

}

export default EditUserPassDialog