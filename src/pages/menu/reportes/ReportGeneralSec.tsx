import { ButtonGroup, Card, CardActions, CardContent, Grid, Typography } from '@mui/material'
import React from 'react'
import { DatePicker } from '@mui/x-date-pickers'
import { ReporteInterface } from '../../../interfaces/interfaces'
import { Dayjs } from 'dayjs'
import ReporteGeneralDialog from '../../../components/dialogs/report/ReporteGeneralDialog'

const ReportGeneralSec = () => {
    const [filtro, setFiltro] = React.useState<ReporteInterface>({
        TramoFinal: null,
        TramoInicial: null,
        fechaFinal: new Date,
        fechaInicial: new Date,
    });


    return (
        <Card sx={{ flex: 1 }} style={{}}>
            <CardActions
                style={{
                    justifyContent: "space-between",
                }}
            >
                <Typography sx={{ fontSize: 16 }} fontWeight="bold" color="text.secondary">
                    Reporte General
                </Typography>
                <ButtonGroup >
                    <ReporteGeneralDialog filtro={filtro} />
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
                            }}
                        />
                    </Grid>
                </Grid>
            </CardContent>
        </Card>
    )
}

export default ReportGeneralSec