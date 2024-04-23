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
  Input,
  TextField,
  Typography,
} from "@mui/material";
import React, { useContext, useEffect, useState } from "react";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { RolInterface, UsuarioInterface } from "../../../interfaces/interfaces";
import { getRol } from "../../../api/Rol.api";
import dayjs from "dayjs";
import { url } from "../../../api/url";
import { uploadImage } from "../../../api/Upload.api";
import { deleteUsuario, editUsuario } from "../../../api/Usuario.api";
import { enqueueSnackbar } from "notistack";
import { SesionContext } from "../../../context/SesionProvider";
import { usuarioExample } from "../../../data/example";
interface EditUserDialogProps {
  user: UsuarioInterface;
  setUser: (poste: UsuarioInterface) => void;
  functionApp: () => void;
  setOpen: (open: boolean) => void;
  open: boolean;
}

const EditUserDialog: React.FC<EditUserDialogProps> = ({ user, setUser, functionApp, setOpen, open }) => {
  const [cargando, setCargando] = useState(false);

  const [data, setData] = useState({ ...user });
  const [listTipoData, setListTipoData] = useState<RolInterface[]>([]);
  const [image, setImage] = useState<File | null>();
  const { sesion } = useContext(SesionContext);
  const [openDelete, setOpenDelete] = useState(false);


  useEffect(() => {
    recibirDatos()
  }, [open])

  const recibirDatos = async () => {
    //console.log(data)
    setCargando(true)

    setListTipoData(await getRol(sesion.token))
    await setCargando(false)

  }

  const handleClose = () => {
    setOpen(false);
    setUser(usuarioExample)
    functionApp();
  };

  const handleClickOpenDelete = () => {
    setOpenDelete(true);
  };

  const handleCloseDelete = () => {
    setOpenDelete(false);
  };

  const handleDelete = async () => {
    setCargando(true)
    const reponse = await deleteUsuario(data?.id as number, sesion.token);
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


  // @ts-expect-error No se sabe el tipo de event
  const onImageChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      setImage(event.target.files[0]);
    }
  };

  const handleEdit = async () => {
    setCargando(true)
    if (data.name != '' && data.lastname != '' && data.phone != '' && data.pass != '' && data.user != '' && data.id_rol != 0) {
      let newData: UsuarioInterface = { ...data }
      if (image) {
        const reponseUpload = await uploadImage(image, sesion.token);
        if (reponseUpload != "500") {
          newData = { ...newData, image: reponseUpload };
        }
        else {
          setCargando(false)
          enqueueSnackbar("No se pudo Editado la imagen", {
            variant: "error",
          });
        }
      }

      const reponse = await editUsuario(newData, sesion.token);

      if (Number(reponse) === 200) {
        setCargando(false)
        enqueueSnackbar("Editado con exito", {
          variant: "success",
        });
        handleClose()
      }
      else {
        setCargando(false)
        enqueueSnackbar("No se pudo Editado", {
          variant: "error",
        });
      }
    } else {
      setCargando(false)
      enqueueSnackbar("Rellena todos los espacios", {
        variant: "warning",
      });
    }
  }

  return (
    <>
      <Dialog
        fullWidth
        open={open}
        onClose={handleClose}
      >
        <DialogTitle>{"Editar nuevo usuario"}</DialogTitle>
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
                value={data.name}
                onChange={(event) => {
                  const newData: UsuarioInterface = { ...data, name: event.target.value };
                  setData(newData)
                }}
              />
            </Grid>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth

                label="Apellidos"
                value={data.lastname}
                onChange={(event) => {
                  const newData: UsuarioInterface = { ...data, lastname: event.target.value };
                  setData(newData)
                }}
              />
            </Grid>
            <Grid
              item
              sx={{ p: 0 }}
              xs={12}
              md={6}
              paddingBlock={1}
              paddingInline={0}
            >
              <Grid container sx={{ p: 0 }}>
                <Grid item xs={12} >
                  <TextField
                    fullWidth
                    style={{
                      padding: 0,
                      margin: 0,
                    }}
                    label="Telefono"
                    value={data.phone}
                    onChange={(event) => {
                      const newData: UsuarioInterface = { ...data, phone: event.target.value };
                      setData(newData)
                    }}
                  />
                </Grid>
                <Grid item xs={12} >

                  <DatePicker
                    sx={{ width: 1 }}

                    label="Fecha de nacimiento"
                    format="DD-MM-YYYY"
                    defaultValue={dayjs(data.birthday)}
                    onChange={(date) => {
                      if (date) {
                        const newData: UsuarioInterface = { ...data, birthday: date.toDate() };
                        setData(newData)
                        //console.log(newData)
                      }
                    }}
                  />

                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    disabled
                    style={{
                      padding: 0,
                      margin: 0,
                    }}
                    label="Usuario"
                    value={data.user}
                    onChange={(event) => {
                      const newData: UsuarioInterface = { ...data, user: event.target.value };
                      setData(newData)
                    }}
                  />
                </Grid>

                <Grid item xs={12}>

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
                    value={listTipoData.find(tipoObs => tipoObs.id === data.id_rol) || null}

                    onChange={(_event, newValue) => {
                      const newData: UsuarioInterface = { ...data, id_rol: newValue?.id ? newValue?.id : 0 };
                      setData(newData)
                    }}
                    renderInput={(params) => <TextField {...params} label="Rol de Usuario" />}



                  />
                </Grid>
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
              <Typography
                display={"flex"}
                color="text.secondary"
                paddingInline={1}
                textAlign={"left"}
              >
                Imagen:
              </Typography>
              <Input fullWidth onChange={onImageChange} type={"file"} />
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
          </Grid>
        </DialogContent>
        <DialogActions
          style={{
            display: "flex",
            justifyContent: "space-between"
          }}
        >
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
        <Dialog
          open={openDelete}
          onClose={handleCloseDelete}
        >
          <DialogTitle>{"Eliminar Usuario"}</DialogTitle>
          <DialogContent>
            <Grid container width={1} m={0}>
              Seguro que quiere eliminar este Usuario?
            </Grid>
          </DialogContent>
          <DialogActions>

            <Button onClick={handleCloseDelete}>Cancelar</Button>
            <Button onClick={handleDelete}>Eliminar</Button>
          </DialogActions>
        </Dialog>

      </Dialog>
      {cargando && (
        <Box sx={{ height: "100vh", width: "100vw", top: 0, left: 0, alignContent: "center", textAlign: "center", backgroundColor: 'rgba(0, 0, 0, 0.25)', position: "fixed", zIndex: "1301" }} >
          <CircularProgress sx={{ color: "white" }} />
        </Box>
      )}
    </>

  );
};

export default EditUserDialog;
