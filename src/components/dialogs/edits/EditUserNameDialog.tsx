import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField } from '@mui/material';
import React, { useContext } from 'react'
import { SesionContext } from '../../../context/SesionProvider';
import { UsuarioInterface } from '../../../interfaces/interfaces';
import { usuarioExample } from '../../../data/example';
import { enqueueSnackbar } from 'notistack';
import { editUserName, searchUsuario_user } from '../../../api/Usuario.api';
import { loginUsuario } from '../../../api/Login.api';

const EditUserNameDialog = () => {
    const [open, setOpen] = React.useState(false);
    const [data, setData] = React.useState<UsuarioInterface>(usuarioExample);
    const { sesion } = useContext(SesionContext);


    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setData(usuarioExample)
    };

    return (
        <React.Fragment>
            <Button onClick={handleClickOpen}>
                {"Editar Nombre de Usuario"}
            </Button>
            <Dialog
                fullWidth
                open={open}
                onClose={handleClose}
            >
                <DialogTitle>{"Editar nombre de usuario"}</DialogTitle>
                <DialogContent>
                    <Grid container width={1} m={0}>
                        <Grid item xs={12} md={6}>
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
                                label="Nuevo nombre de usuario"
                                value={data.user}
                                onChange={(event) => {
                                    const newData: UsuarioInterface = { ...data, user: event.target.value };
                                    setData(newData)
                                }}
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>Cancelar</Button>
                    <Button onClick={async () => {

                        //console.log({ ...sesion.usuario, pass: data.pass })

                        const responde = await loginUsuario({ ...sesion.usuario, pass: data.pass });
                        if (responde.status != 500) {
                            if (data.user != '' && data.pass) {
                                const userExist = await searchUsuario_user(data.user, sesion.token);
                                if (!userExist) {
                                    const reponse = await editUserName({ ...sesion.usuario, user: data.user }, sesion.token);
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
                                    enqueueSnackbar("Este usuario ya existe", {
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

export default EditUserNameDialog