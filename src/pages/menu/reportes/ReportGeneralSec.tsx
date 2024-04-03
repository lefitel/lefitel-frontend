import { ButtonGroup, Card, CardActions, CardContent, Grid, Typography } from '@mui/material'
import React from 'react'
import { DatePicker } from '@mui/x-date-pickers'
import { ReporteInterface } from '../../../interfaces/interfaces'
import dayjs from 'dayjs'
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
                            defaultValue={dayjs(new Date())}
                            onChange={(date) => {
                                if (date) {
                                    const newData: ReporteInterface = { ...filtro, fechaInicial: date.toDate() };
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
                            defaultValue={dayjs(new Date())}
                            onChange={(date) => {
                                if (date) {
                                    const newData: ReporteInterface = { ...filtro, fechaFinal: date.toDate() };
                                    setFiltro(newData)
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