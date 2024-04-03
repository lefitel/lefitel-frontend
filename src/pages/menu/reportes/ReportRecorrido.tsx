import { Autocomplete, ButtonGroup, Card, CardActions, CardContent, Grid, TextField, Typography } from '@mui/material'
import { useContext, useEffect, useState } from 'react'
import { DatePicker } from '@mui/x-date-pickers'
import { CiudadInterface, ReporteInterface } from '../../../interfaces/interfaces'
import dayjs from 'dayjs'
import ReporteRecorridoDialog from '../../../components/dialogs/report/ReporteRecorridoDialog'
import { getCiudad } from '../../../api/Ciudad.api'
import { SesionContext } from '../../../context/SesionProvider'

const ReportRecorridoSec = () => {
    const { sesion } = useContext(SesionContext);

    const [filtro, setFiltro] = useState<ReporteInterface>({
        TramoFinal: null,
        TramoInicial: null,
        fechaFinal: new Date,
        fechaInicial: new Date,
    });
    const [listCiudad, setListCiudad] = useState<CiudadInterface[]>([]);


    const recibirDatos = async () => {
        setListCiudad(await getCiudad(sesion.token))
    }

    useEffect(() => {
        recibirDatos()
    }, [])


    return (
        <Card sx={{ flex: 1 }} style={{}}>
            <CardActions
                style={{
                    justifyContent: "space-between",
                }}
            >
                <Typography sx={{ fontSize: 16 }} fontWeight="bold" color="text.secondary">
                    Reporte de Recorrido
                </Typography>
                <ButtonGroup >
                    <ReporteRecorridoDialog filtro={filtro} />

                </ButtonGroup>
            </CardActions>
            <CardContent style={{}}>
                <Grid container>
                    <Grid item xs={6} >
                        <DatePicker
                            sx={{ width: 1 }}
                            label="Fecha de inicio"
                            format="DD-MM-YYYY"
                            defaultValue={dayjs(new Date)}
                            onChange={(date) => {
                                if (date) {
                                    const newData: ReporteInterface = { ...filtro, fechaInicial: date.toDate() };
                                    setFiltro(newData)
                                    //console.log(newData)
                                }
                            }}
                        />
                    </Grid>
                    <Grid item xs={6} >
                        <DatePicker
                            sx={{ width: 1 }}
                            label="Fecha de fin"
                            format="DD-MM-YYYY"
                            defaultValue={dayjs(new Date)}
                            onChange={(date) => {
                                if (date) {
                                    const newData: ReporteInterface = { ...filtro, fechaInicial: date.toDate() };
                                    setFiltro(newData)
                                    //console.log(newData)
                                }
                            }} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Autocomplete
                            renderOption={(props, option) => {
                                return (
                                    <li {...props} key={option.id}>
                                        {option.name}
                                    </li>
                                );
                            }}
                            disablePortal

                            options={listCiudad}
                            getOptionLabel={(option) => option.name}

                            onChange={(_event, newValue) => {
                                const newData: ReporteInterface = { ...filtro, TramoInicial: newValue?.id ? newValue?.id : 0 };
                                setFiltro(newData)
                            }}
                            renderInput={(params) => <TextField {...params} label="Tramo Inicial" />}
                        />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Autocomplete
                            renderOption={(props, option) => {
                                return (
                                    <li {...props} key={option.id}>
                                        {option.name}
                                    </li>
                                );
                            }}
                            disablePortal

                            options={listCiudad}
                            getOptionLabel={(option) => option.name}

                            onChange={(_event, newValue) => {
                                const newData: ReporteInterface = { ...filtro, TramoFinal: newValue?.id ? newValue?.id : 0 };
                                setFiltro(newData)
                            }}
                            renderInput={(params) => <TextField {...params} label="Tramo Final" />}
                        />
                    </Grid>
                </Grid>
            </CardContent>
        </Card>
    )
}

export default ReportRecorridoSec