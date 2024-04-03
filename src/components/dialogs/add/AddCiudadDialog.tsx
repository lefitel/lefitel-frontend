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
import { Add } from "@mui/icons-material";
import { CiudadInterface } from "../../../interfaces/interfaces";
import { useSnackbar } from "notistack";
import { createCiudad } from "../../../api/Ciudad.api";
import { MapContainer, Marker, Popup, TileLayer, useMapEvent } from "react-leaflet";
import { ciudadExample } from "../../../data/example";
import { SesionContext } from "../../../context/SesionProvider";
import { uploadImage } from "../../../api/Upload.api";

interface AddCiudadDialogProps {
    functionApp: () => void;
}



const AddCiudadDialog: React.FC<AddCiudadDialogProps> = ({ functionApp }) => {

    const [open, setOpen] = useState(false);
    const [data, setData] = useState<CiudadInterface>(ciudadExample);
    const { enqueueSnackbar } = useSnackbar();
    const { sesion } = useContext(SesionContext);
    const [image, setImage] = useState<File | null>();

    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setData(ciudadExample)
        setOpen(false);
        functionApp();
    };
    /* @ts-expect-error No se sabe el tipo de event */
    const onImageChange = (event) => {
        if (event.target.files && event.target.files[0]) {
            setImage(event.target.files[0]);
        }
    };

    function LocationMarker() {
        /* @ts-expect-error No se sabe el tipo de event */
        const map = useMapEvent('click', (event) => {
            const newData: CiudadInterface = { ...data, lat: event.latlng.lat, lng: event.latlng.lng };
            setData(newData)
            map.flyTo(event.latlng, map.getZoom())
        })


        return null
    }

    return (
        <React.Fragment>
            <Button startIcon={<Add />} onClick={handleClickOpen}>
                {"Nuevo Ciudad"}
            </Button>
            <Dialog
                fullWidth
                open={open}
                onClose={handleClose}
            >
                <DialogTitle>{"Insertar nuevo Ciudad"}</DialogTitle>
                <DialogContent>
                    <Grid container width={1} m={0}>
                        <Grid item xs={12} md={12}   >
                            <TextField
                                fullWidth
                                style={{
                                    padding: 0,
                                    margin: 0,
                                }}
                                label="Nombre"
                                onChange={(event) => {
                                    const newData: CiudadInterface = { ...data, name: event.target.value };
                                    setData(newData)
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6} sx={{ padding: 0 }} >
                            <Grid container sx={{ padding: 0 }} >
                                <Grid item xs={12}>
                                    <Typography
                                        display={"flex"}
                                        color="text.secondary"
                                        textAlign={"left"}
                                        paddingInline={1}
                                    >
                                        Ubicación:
                                    </Typography>
                                </Grid>
                                <Grid container sx={{ padding: 0 }} >
                                    <Grid item xs={6}>
                                        <TextField
                                            fullWidth
                                            style={{
                                                padding: 0,
                                                margin: 0,
                                            }}
                                            type="number"
                                            label="Latitud"
                                            value={data.lat}
                                            onChange={(event) => {
                                                const newData: CiudadInterface = { ...data, lat: Number.parseInt(event.target.value) };
                                                setData(newData)
                                            }}
                                        />
                                    </Grid>
                                    <Grid item xs={6}>
                                        <TextField
                                            fullWidth
                                            style={{
                                                padding: 0,
                                                margin: 0,
                                            }}
                                            type="number"
                                            label="Longitud"
                                            value={data.lng}

                                            onChange={(event) => {
                                                const newData: CiudadInterface = { ...data, lng: Number.parseInt(event.target.value) };
                                                setData(newData)
                                            }}
                                        />
                                    </Grid>
                                </Grid>
                            </Grid>
                            <Grid>
                                {/* @ts-expect-error No se sabe el tipo de event */}
                                <MapContainer center={[data.lat, data.lng]}
                                    zoom={13}
                                    style={{ height: "200px" }}
                                    scrollWheelZoom={false}

                                >
                                    <TileLayer url="https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png" />

                                    <LocationMarker />
                                    <Marker position={[data.lat, data.lng]}>
                                        <Popup>You are here</Popup>
                                    </Marker>
                                </MapContainer>
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
                            if (image && data.name != '' && data.lat != 0 && data.lng != 0) {

                                const reponseUpload = await uploadImage(image, sesion.token);

                                if (reponseUpload != "500") {

                                    const newData: CiudadInterface = { ...data, image: reponseUpload };

                                    const reponse = await createCiudad(newData, sesion.token);

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


export default AddCiudadDialog;
