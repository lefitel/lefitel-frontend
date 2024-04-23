import { Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Grid, TextField } from '@mui/material';
import React, { useContext, useState } from 'react'
import { SesionContext } from '../../../context/SesionProvider';
import { UsuarioInterface } from '../../../interfaces/interfaces';
import { usuarioExample } from '../../../data/example';
import { enqueueSnackbar } from 'notistack';
import { editUserName, searchUsuario_user } from '../../../api/Usuario.api';
import { loginUsuario } from '../../../api/Login.api';

const EditUserNameDialog = () => {
    const [cargando, setCargando] = useState(false);

    const [open, setOpen] = useState(false);
    const [data, setData] = useState<UsuarioInterface>(usuarioExample);
    const { sesion } = useContext(SesionContext);


    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setData(usuarioExample)
    };

    const handleEdit = async () => {
        setCargando(true)
        const responde = await loginUsuario({ ...sesion.usuario, pass: data.pass });
        if (responde.status != 500) {
            if (data.user != '' && data.pass) {
                const userExist = await searchUsuario_user(data.user, sesion.token);
                if (!userExist) {
                    const reponse = await editUserName({ ...sesion.usuario, user: data.user }, sesion.token);
                    if (Number(reponse) === 200) {
                        setCargando(false)
                        enqueueSnackbar("Editado con exito", {
                            variant: "success",
                        });
                        handleClose()
                    }
                    else {
                        setCargando(false)
                        enqueueSnackbar("No se pudo Editar", {
                            variant: "error",
                        });
                    }
                } else {
                    setCargando(false)
                    enqueueSnackbar("Este usuario ya existe", {
                        variant: "warning",
                    });
                }

            } else {
                setCargando(false)
                enqueueSnackbar("Rellena todos los espacios", {
                    variant: "warning",
                });
            }
        } else {
            setCargando(false)
            enqueueSnackbar(responde.message, {
                variant: "error",
            });
        }
    }

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
                    <Button onClick={handleEdit}>Guardar</Button>
                </DialogActions>
            </Dialog>
            {cargando && (
                <Box sx={{ height: "100vh", width: "100vw", top: 0, left: 0, alignContent: "center", backgroundColor: 'rgba(0, 0, 0, 0.25)', position: "fixed", zIndex: "1301" }} >
                    <CircularProgress sx={{ color: "white" }} />
                </Box>
            )}
        </React.Fragment>
    )
}

export default EditUserNameDialog