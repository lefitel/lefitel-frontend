import { ButtonGroup, Card, CardActions, CardContent, Grid, Typography } from '@mui/material'
import { DatePicker } from '@mui/x-date-pickers'
import { ReporteInterface } from '../../../interfaces/interfaces'
import { Dayjs } from 'dayjs'
import { useState } from 'react'
import ReporteTramoDialog from '../../../components/dialogs/report/ReporteTramoDialog'

const ReportTramoSec = () => {
    //const { sesion } = useContext(SesionContext);

    const [filtro, setFiltro] = useState<ReporteInterface>({
        TramoFinal: null,
        TramoInicial: null,
        fechaFinal: new Date(),
        fechaInicial: new Date(),
    });
    //const [listCiudad, setListCiudad] = useState<CiudadInterface[]>([]);

    /*
        const recibirDatos = async () => {
            setListCiudad(await getCiudad(sesion.token))
        }
    
        useEffect(() => {
            recibirDatos()
        }, [])
    */

    return (
        <Card sx={{ flex: 1 }} style={{}}>
            <CardActions
                style={{
                    justifyContent: "space-between",
                }}
            >
                <Typography sx={{ fontSize: 16 }} fontWeight="bold" color="text.secondary">
                    Reporte Por Tramo
                </Typography>
                <ButtonGroup >
                    <ReporteTramoDialog filtro={filtro} />

                </ButtonGroup>
            </CardActions>
            <CardContent style={{}}>
                <Grid container>
                    <Grid item xs={6} >
                        <DatePicker
                            sx={{ width: 1 }}
                            label="Fecha de inicio"
                            format="DD-MM-YYYY"
                            onChange={(date: Dayjs | null) => {
                                if (date) {
                                    const fechaActualizada = new Date(date.toDate().setHours(0, 0, 0, 0));
                                    const newData: ReporteInterface = { ...filtro, fechaInicial: fechaActualizada };
                                    setFiltro(newData)
                                    console.log(newData)
                                }
                            }}
                        />
                    </Grid>
                    <Grid item xs={6} >
                        <DatePicker
                            sx={{ width: 1 }}
                            label="Fecha de fin"
                            format="DD-MM-YYYY"
                            onChange={(date: Dayjs | null) => {
                                if (date) {
                                    const fechaActualizada = new Date(date.toDate().setHours(23, 59, 59, 0));
                                    const newData: ReporteInterface = { ...filtro, fechaFinal: fechaActualizada };
                                    setFiltro(newData)
                                    console.log(newData)
                                }
                            }} />
                    </Grid>

                </Grid>
            </CardContent>
        </Card>
    )
}

export default ReportTramoSec

/*
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
*/