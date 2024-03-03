import { Add, ArrowDropDown } from "@mui/icons-material";
import {
  Autocomplete,
  Button,
  ButtonGroup,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Input,
  TextField,
  Typography,
} from "@mui/material";
import React, { useState } from "react";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import { useSnackbar } from "notistack";
import { RolInterface, UsuarioInterface } from "../../../interfaces/interfaces";
import { getRol } from "../../../api/Rol.api";
import { createUsuario } from "../../../api/Usuario.api";
import { uploadImage } from "../../../api/Upload.api";
import dayjs from "dayjs";

interface AddUserDialogProps {
  functionApp: () => void;
}
const AddUserDialog: React.FC<AddUserDialogProps> = ({ functionApp }) => {
  const [open, setOpen] = React.useState(false);
  const [passConfirm, setPassConfirm] = React.useState("");

  const [data, setData] = React.useState<UsuarioInterface>(
    { name: "", lastname: "", user: "", pass: "", phone: "", image: "", birthday: new Date(), id_rol: 0 }
  );
  const { enqueueSnackbar } = useSnackbar();
  const [listTipoData, setListTipoData] = React.useState<RolInterface[]>([]);
  const [image, setImage] = useState<File | null>();



  const recibirDatos = async () => {
    setListTipoData(await getRol())
  }
  const handleClickOpen = () => {
    recibirDatos()
    setOpen(true);
  };

  const handleClose = () => {
    setData({ name: "", lastname: "", user: "", pass: "", phone: "", image: "", birthday: new Date(), id_rol: 0 })
    setOpen(false);
    functionApp()
    setImage(null)
  };


  const onImageChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      setImage(event.target.files[0]);
    }
  };
  return (
    <React.Fragment>
      <Button startIcon={<Add />} variant="outlined" onClick={handleClickOpen}>
        {"Nuevo Usuario"}
      </Button>
      <Dialog
        fullWidth
        open={open}
        onClose={handleClose}
      >
        <DialogTitle>{"Insertar nuevo usuario"}</DialogTitle>
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
                  const newData: UsuarioInterface = { ...data, name: event.target.value };
                  setData(newData)
                }}
              />
            </Grid>
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                style={{
                  padding: 0,
                  margin: 0,
                }}
                label="Apellidos"
                onChange={(event) => {
                  const newData: UsuarioInterface = { ...data, lastname: event.target.value };
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
                label="Telefono"
                onChange={(event) => {
                  const newData: UsuarioInterface = { ...data, phone: event.target.value };
                  setData(newData)
                }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
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
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    style={{
                      padding: 0,
                      margin: 0,
                    }}
                    label="Usuario"
                    onChange={(event) => {
                      const newData: UsuarioInterface = { ...data, user: event.target.value };
                      setData(newData)
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    type="password"
                    style={{
                      padding: 0,
                      margin: 0,
                    }}
                    label="Contraseña"
                    onChange={(event) => {
                      const newData: UsuarioInterface = { ...data, pass: event.target.value };
                      setData(newData)
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    type="password"
                    style={{
                      padding: 0,
                      margin: 0,
                    }}
                    label="Confirmar Contraseña"
                    onChange={(event) => {
                      setPassConfirm(event.target.value)
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Autocomplete
                    disablePortal

                    options={listTipoData}
                    getOptionLabel={(option) => option.name}

                    onChange={(event, newValue) => {
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
                  loading="lazy"
                  src={"https://as2.ftcdn.net/v2/jpg/03/49/49/79/1000_F_349497933_Ly4im8BDmHLaLzgyKg2f2yZOvJjBtlw5.jpg"}
                  alt="Preview" />
              }

            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <ButtonGroup>
            <Button onClick={handleClose}>Cancelar</Button>
            <Button onClick={async () => {


              //console.log(data)
              if (image && data.name != '' && data.lastname != '' && data.phone != '' && data.pass != '' && passConfirm != '' && data.user != '' && data.id_rol != 0) {
                if (data.pass === passConfirm) {
                  const reponseUpload = await uploadImage(image);
                  if (reponseUpload != "500") {
                    const newData: UsuarioInterface = { ...data, image: reponseUpload };
                    const reponse = await createUsuario(newData);

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
                  } else {
                    enqueueSnackbar("No se pudo Ingresar la imagen", {
                      variant: "error",
                    });
                  }
                } else {
                  enqueueSnackbar("Las contraseñas no son iguales", {
                    variant: "warning",
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

export default AddUserDialog;
