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
import React, { useContext, useState } from "react";
import { Add } from "@mui/icons-material";
import { CiudadInterface } from "../../../interfaces/interfaces";
import { useSnackbar } from "notistack";
import { createCiudad } from "../../../api/Ciudad.api";
import { MapContainer, Marker, Popup, TileLayer, useMapEvent } from "react-leaflet";
import { latExample, lngExample } from "../../../data/example";
import { SesionContext } from "../../../context/SesionProvider";

interface AddCiudadDialogProps {
    functionApp: () => void;
}



const AddCiudadDialog: React.FC<AddCiudadDialogProps> = ({ functionApp }) => {

    const [open, setOpen] = useState(false);
    const [data, setData] = useState<CiudadInterface>({ id: 0, name: "", lat: latExample, lng: lngExample });
    const { enqueueSnackbar } = useSnackbar();
    const { sesion } = useContext(SesionContext);

    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setData({ id: 0, name: "", lat: latExample, lng: lngExample })
        setOpen(false);
        functionApp();
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
            <Button startIcon={<Add />} variant="outlined" onClick={handleClickOpen}>
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
                        <Grid item xs={12} md={12}>
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
                        <Grid item xs={12} md={12}>
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
                </DialogContent>
                <DialogActions>
                    <ButtonGroup>
                        <Button onClick={handleClose}>Cancelar</Button>
                        <Button onClick={async () => {
                            if (data.name != '' && data.lat != 0 && data.lng != 0) {
                                const reponse = await createCiudad(data, sesion.token);

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


export default AddCiudadDialog;
