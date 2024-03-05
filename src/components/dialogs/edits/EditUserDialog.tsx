import { Edit } from "@mui/icons-material";
import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Input,
  TextField,
  Typography,
} from "@mui/material";
import React, { useContext, useState } from "react";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { RolInterface, UsuarioInterface } from "../../../interfaces/interfaces";
import { getRol } from "../../../api/Rol.api";
import dayjs from "dayjs";
import { url } from "../../../api/url";
import { uploadImage } from "../../../api/Upload.api";
import { editUsuario } from "../../../api/Usuario.api";
import { enqueueSnackbar } from "notistack";
import { SesionContext } from "../../../context/SesionProvider";
interface EditUserDialogProps {
  user: UsuarioInterface;
  functionApp: () => void;

}
const EditUserDialog: React.FC<EditUserDialogProps> = ({ user, functionApp }) => {

  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState({ ...user });
  const [listTipoData, setListTipoData] = React.useState<RolInterface[]>([]);
  const [image, setImage] = useState<File | null>();
  const { sesion } = useContext(SesionContext);

  const recibirDatos = async () => {
    //console.log(data)
    setListTipoData(await getRol(sesion.token))
  }
  const handleClickOpen = () => {
    recibirDatos()
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    functionApp();
  };


  const onImageChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      setImage(event.target.files[0]);
    }
  };
  return (
    <React.Fragment>
      <Button startIcon={<Edit />} variant="outlined" onClick={handleClickOpen}>
        {"Editar Usuario"}
      </Button>
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
                style={{
                  padding: 0,
                  margin: 0,
                }}
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
              sx={{
                height: "100%",
              }}
              xs={12}
              md={6}
              paddingBlock={1}
              paddingInline={0}
            >
              <Grid container m={0} p={0}>
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
                  src={`${url}${data.image}`}
                  alt={"imagen"}
                  loading="lazy"
                />
              }

            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancelar</Button>
          <Button onClick={async () => {
            //console.log(data)

            if (data.name != '' && data.lastname != '' && data.phone != '' && data.pass != '' && data.user != '' && data.id_rol != 0) {
              let newData: UsuarioInterface = { ...data }
              if (image) {
                const reponseUpload = await uploadImage(image, sesion.token);
                if (reponseUpload != "500") {
                  newData = { ...newData, image: reponseUpload };
                }
                else {
                  enqueueSnackbar("No se pudo Ingresar la imagen", {
                    variant: "error",
                  });
                }
              }

              const reponse = await editUsuario(newData, sesion.token);

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
              enqueueSnackbar("Rellena todos los espacios", {
                variant: "warning",
              });
            }




          }}>Guardar</Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
};

export default EditUserDialog;
