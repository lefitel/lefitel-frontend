import {
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
import React, { useContext, useState } from "react";
import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import { DatePicker } from "@mui/x-date-pickers";
import { Add } from "@mui/icons-material";
import { EventoInterface, SolucionInterface } from "../../../interfaces/interfaces";
import { solucionExample } from "../../../data/example";
import dayjs from "dayjs";
import { uploadImage } from "../../../api/Upload.api";
import { createSolucion } from "../../../api/Solucion.api";
import { editEvento } from "../../../api/Evento.api";
import { useSnackbar } from "notistack";
import { SesionContext } from "../../../context/SesionProvider";

interface AddSolucionDialogProps {
  evento: EventoInterface;
  functionApp: () => void;
}

const AddSolucionDialog: React.FC<AddSolucionDialogProps> = ({ functionApp, evento }) => {
  const [open, setOpen] = React.useState(false);
  const [data, setData] = React.useState<SolucionInterface>({ ...solucionExample, id_evento: evento?.id as number });
  const [image, setImage] = useState<File | null>();
  const { enqueueSnackbar } = useSnackbar();
  const { sesion } = useContext(SesionContext);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    functionApp()
    setOpen(false);
    setData({ ...solucionExample, id_evento: evento?.id as number })
    setImage(null)
  };

  /* @ts-expect-error No se sabe el tipo de event */
  const onImageChange = (event) => {
    if (event.target.files && event.target.files[0]) {
      setImage(event.target.files[0]);
    }
  };
  const handleGuardar = async () => {
    console.log(data)
    if (image && data.description != '' && data.id_evento != 0) {
      const reponseUpload = await uploadImage(image, sesion.token);
      if (reponseUpload != "500") {

        const newData: SolucionInterface = { ...data, image: reponseUpload };
        const reponse = await createSolucion(newData, sesion.token);

        if (Number(reponse.status) === 200) {

          await editEvento({ ...evento, state: true }, sesion.token);

          handleClose()
          enqueueSnackbar("Ingresado con exito", {
            variant: "success",
          })
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
    }
    else {
      enqueueSnackbar("Rellena todos los espacios", {
        variant: "warning",
      });
    }
  }
  return (
    <React.Fragment>
      <Button startIcon={<Add />} variant="outlined" onClick={handleClickOpen}>
        {"Solucionar"}
      </Button>
      <Dialog
        fullWidth
        open={open}
        onClose={handleClose}
      >
        <DialogTitle>{"Solucionar evento"}</DialogTitle>
        <DialogContent>
          <Grid container width={1} m={0}>
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
              <Grid item xs={12}>
                <TextField
                  disabled
                  fullWidth
                  style={{
                    padding: 0,
                    margin: 0,
                  }}
                  type="number"
                  label="Numero de evento"
                  value={evento.id}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  multiline
                  style={{
                    padding: 0,
                    margin: 0,
                  }}
                  label="Descripción"
                  value={data.id}
                  onChange={(event) => {
                    const newData: SolucionInterface = { ...data, description: event.target.value };
                    setData(newData)
                  }}
                />
              </Grid>
              <Grid item xs={12}>
                <DemoContainer sx={{ p: 0 }} components={["DatePicker"]}>
                  <DatePicker
                    sx={{ width: 1 }}

                    label="Fecha de solucion"
                    format="DD-MM-YYYY"
                    defaultValue={dayjs(data.date)}
                    onChange={(date) => {
                      if (date) {
                        const newData: SolucionInterface = { ...data, date: date.toDate() };
                        setData(newData)
                      }
                    }}
                  />
                </DemoContainer>
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
            <Button onClick={handleGuardar}>Guardar</Button>
          </ButtonGroup>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
};

export default AddSolucionDialog;
