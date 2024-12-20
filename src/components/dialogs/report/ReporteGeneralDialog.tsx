import { DocumentScanner } from '@mui/icons-material'
import { AppBar, Box, Button, CircularProgress, Dialog, DialogContent, IconButton, Toolbar, Typography, lighten, styled } from '@mui/material'
import React, { useContext, useState } from 'react'
import { EventoInterface, ReporteInterface } from '../../../interfaces/interfaces';
import { SesionContext } from '../../../context/SesionProvider';
import { getReporteGeneral } from '../../../api/reporte.api';
import { url } from '../../../api/url';
import { useSnackbar } from 'notistack';
import { DataGridPremium, GridCloseIcon, GridColDef, GridColumnGroupingModel, GridExceljsProcessInput, GridToolbar } from '@mui/x-data-grid-premium';
import axios from 'axios';


const StyledDataGrid = styled(DataGridPremium)(() => ({
    '& .custom-row-5': {
        backgroundColor: lighten("#DD0031", 0.4),
        '&:hover': {
            backgroundColor: lighten("#DD0031", 0.5),
        },

    },
    '& .custom-row-2': {
        backgroundColor: lighten("#FF5500", 0.4),
        '&:hover': {
            backgroundColor: lighten("#FF5500", 0.5),
        },

    },
    '& .custom-row-1': {
        backgroundColor: lighten("#F6BF12", 0.4),
        '&:hover': {
            backgroundColor: lighten("#F6BF12", 0.5),
        },

    },
    '& .custom-row-0': {
        backgroundColor: lighten("#249243", 0.4),
        '&:hover': {
            backgroundColor: lighten("#249243", 0.5),
        },

    },
}));

const columns: GridColDef[] = [

    {
        field: 'poste', headerName: 'Nmr',
        valueGetter(_params, row) {
            return row.poste.name
        },
    },
    {
        field: 'lat', headerName: 'Latitud',
        //renderCell: (params) => { return params.row.poste.lat; },
        valueGetter(_params, row) { return row.poste.lat },
    },
    {
        field: 'lng', headerName: 'Longitud',
        valueGetter(_params, row) { return row.poste.lng },

    },
    {
        field: 'tramo', headerName: 'Tramo',
        valueGetter(_params, row) { return `${row.poste.ciudadA.name} - ${row.poste.ciudadB.name}` },
    },
    {
        field: 'fecha', headerName: 'Fecha', type: 'date',
        valueGetter(_params, row) {
            const date = new Date(row.date);
            return date;
        }
    },
    {
        field: 'hora', headerName: 'Hora',
        valueGetter(_params, row) {
            const date = new Date(row.date);
            return date.toTimeString();
        }
    },
    { field: 'description', headerName: 'Descripción' },
    {
        field: 'revicions', headerName: 'Reviciones',
        //renderCell: (params) => { return params.row.revicions.length }
        valueGetter(_params, row) { return row.revicions.length },

    },
    {
        field: 'image', headerName: 'Foto',
        renderCell: (params) => (<img src={`${url}${params.row.image}`} style={{ height: 100 }} />),
        valueGetter(_params, row) { return `${url}${row.image}` },
    },

    {
        field: 'fechaSol', headerName: 'Fecha', type: 'date',
        valueGetter(_params, row) {
            if (row.solucions.length > 0) {
                const date = new Date(row.solucions[0].date);
                return date;
            } else { return "" }
        },

    },
    {
        field: 'horaSol', headerName: 'Hora',
        valueGetter(_params, row) {
            if (row.solucions.length > 0) {

                const date = new Date(row.solucions[0].date);
                return date.toTimeString();
            } else { return "" }
        },

    },
    {
        field: 'descriptionSol', headerName: 'Descripción',
        valueGetter(_params, row) {
            if (row.solucions.length > 0) { return row.solucions[0].description }
            else { return }
        },

    },
    {
        field: 'imageSol', headerName: 'Foto',
        valueGetter(_params, row) {
            if (row.solucions.length > 0) { return `${url}${row.solucions[0].image}` }
            else { return }
        },

        renderCell: (params) => {
            if (params.row.solucions.length > 0) {
                return <img src={`${url}${params.row.solucions[0].image}`} style={{ height: 100 }} />;
            } else { return }
        }
    }
];

const columnGroupingModel: GridColumnGroupingModel = [
    {
        groupId: 'Poste',
        children: [
            { field: 'poste' },
            { field: 'lat' },
            { field: 'lng' },
            { field: 'tramo' },
        ],
    },
    {
        groupId: 'Evento',
        children: [
            { field: 'id' },
            { field: 'image' },
            { field: 'description' },
            { field: 'revicions' },
            { field: 'fecha' },
            { field: 'hora' },
        ],
    },
    {
        groupId: 'Solución',
        children: [
            { field: 'imageSol' },
            { field: 'descriptionSol' },
            { field: 'fechaSol' },
            { field: 'horaSol' },
        ],
    },
];


interface ReporteGeneralDialogProps {
    filtro: ReporteInterface;
}

const ReporteGeneralDialog: React.FC<ReporteGeneralDialogProps> = ({ filtro }) => {

    const [open, setOpen] = useState(false);
    const [list, setList] = useState<EventoInterface[]>([]);

    const { sesion } = useContext(SesionContext);
    const { enqueueSnackbar } = useSnackbar();
    const [cargando, setCargando] = useState(false);

    const handleClickOpen = async () => {
        setCargando(true)
        const Temp = await getReporteGeneral(filtro, sesion.token)
        if (Temp.length > 0) {
            setList(Temp),
                setOpen(true);
        } else {
            enqueueSnackbar("No hay datos", {
                variant: "warning",
            });
        }
        await setCargando(false)
    };

    const handleClose = () => {
        setOpen(false);
    };



    const exceljsPreProcess = ({ workbook, worksheet }: GridExceljsProcessInput) => {
        setCargando(true)
        workbook.creator = 'Lefitel';
        workbook.created = new Date();
        worksheet.properties.defaultRowHeight = 30;
        worksheet.getCell("A1").value = ""
        worksheet.addRow([]);
    };
    const exceljsPostProcess = async ({ workbook, worksheet }: GridExceljsProcessInput) => {
        worksheet.addRow({});
        worksheet.name = 'Reporte';

        let lastRow = 0;
        let lastCol = 0;
        worksheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
            lastRow = Math.max(lastRow, rowNumber);
            row.eachCell({ includeEmpty: true }, function (_cell, colNumber) {
                lastCol = Math.max(lastCol, colNumber);
            });
        });
        lastRow--

        const imageBufferTigo = await axios.get("/tigo.png", { responseType: 'arraybuffer' });
        const imageIdTigo = workbook.addImage({
            buffer: imageBufferTigo.data,
            extension: 'png',
        });
        worksheet.addImage(imageIdTigo, `M1:M2`);

        const imageBufferLefitel = await axios.get("/logo.png", { responseType: 'arraybuffer' });
        const imageIdLefitel = workbook.addImage({
            buffer: imageBufferLefitel.data,
            extension: 'png',
        });
        worksheet.addImage(imageIdLefitel, `A1:A2`);



        for (let i = 5; i <= lastRow; i++) {
            const fila = worksheet.getRow(i);
            fila.height = 75;
            const celda = worksheet.getCell(`I${i}`)
            const celdaSol = worksheet.getCell(`M${i}`)
            const reviciones = worksheet.getCell(`H${i}`).value?.toString()

            if (parseInt(reviciones ? reviciones : "0") >= 1) {

                for (let j = 1; j <= lastCol; j++) {
                    worksheet.getCell(i, j).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'F6BF12' }
                    };
                }
            }
            else if (parseInt(reviciones ? reviciones : "0") > 1 && parseInt(reviciones ? reviciones : "0") < 5) {
                for (let j = 1; j <= lastCol; j++) {
                    worksheet.getCell(i, j).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FF5500' }
                    };
                }
            } else {
                for (let j = 1; j <= lastCol; j++) {
                    worksheet.getCell(i, j).fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'DD0031' }
                    };
                }
            }

            try {
                if (celda.value != "" && celda.value != undefined) {
                    const imageBuffer = await axios.get(celda.value.toString(), { responseType: 'arraybuffer' });
                    const imageId = workbook.addImage({
                        buffer: imageBuffer.data,
                        extension: 'jpeg',
                    });
                    celda.value = ""

                    worksheet.addImage(imageId, `I${i}:I${i}`);
                }
            } catch (e) { console.log(e); }
            try {
                if (celdaSol.value != "" && celdaSol.value != undefined) {
                    const imageBuffer = await axios.get(celdaSol.value.toString(), { responseType: 'arraybuffer' });
                    const imageId = workbook.addImage({
                        buffer: imageBuffer.data,
                        extension: 'jpeg',
                    });
                    celdaSol.value = ""

                    worksheet.addImage(imageId, `M${i}:M${i}`);
                }
            } catch (e) { console.log(e); }



        }


        worksheet.mergeCells(1, 1, 1, 13);
        worksheet.mergeCells(2, 1, 2, 13);

        worksheet.getCell('A1').value = 'RESUMEN DE REPORTES LEFITEL S.R.L.';
        worksheet.getCell('A2').value = filtro.fechaInicial?.toLocaleDateString() + ' - ' + filtro.fechaFinal?.toLocaleDateString();

        worksheet.getCell('A1').font = {
            bold: true,
            size: 36,
        };
        worksheet.getCell('A2').font = {
            bold: true,
            size: 18,
        }
        worksheet.getCell('A1').alignment = {
            vertical: 'middle',
            horizontal: 'center',
            wrapText: true,
        };

        worksheet.getCell('A2').alignment = {
            vertical: 'middle',
            horizontal: 'center',
            wrapText: true,
        };


        for (let row = 3; row <= lastRow; row++) {
            for (let col = 1; col <= lastCol; col++) {
                const cell = worksheet.getCell(row, col);
                // Aplica un estilo de fondo de color a cada celda
                if ((col === 2 || col === 3) && row > 4) {
                    cell.alignment = {
                        vertical: 'middle',
                        horizontal: 'center',
                        wrapText: true,
                        textRotation: 90

                    };
                } else {
                    cell.alignment = {
                        vertical: 'middle',
                        horizontal: 'center',
                        wrapText: true,

                    };
                }

                cell.border = {
                    top: { style: 'medium' },
                    left: { style: 'medium' },
                    bottom: { style: 'medium' },
                    right: { style: 'medium' }
                };
                if (cell.value === "Latitud" || cell.value === "Longitud") {
                    worksheet.getColumn(col).width = 10;
                }

                switch (cell.value) {
                    case 'Poste':
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFE06666' } // Rojo
                        };
                        break;
                    case 'Evento':
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FF6FA8DC' } // Rojo
                        }; break;
                    case 'Solución':
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFe2ac3f' } // Rojo
                        }; break;

                    default:
                }
                if (cell.value === true) {
                    cell.value = "1";
                }
            }
        }

        worksheet.getRow(3).eachCell(function (cell) {
            cell.font = { bold: true, size: 15, };
        });
        worksheet.getRow(4).eachCell(function (cell) {
            cell.font = { bold: true, color: { argb: "FFFFFFFF" } };



            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF001F5D' }
            }
        });

        //worksheet.addRow(['Lefitel']);
        setCargando(false)
    };

    const excelOptions = { exceljsPreProcess, exceljsPostProcess, fileName: "Reporte general del " + new Date().toLocaleDateString() };



    return (
        <React.Fragment>
            <Button startIcon={<DocumentScanner />} onClick={handleClickOpen}>
                {"Generar Reporte"}
            </Button>
            <Dialog
                fullScreen
                fullWidth
                open={open}
                onClose={handleClose}
            >
                <AppBar sx={{ position: 'relative' }}>
                    <Toolbar>
                        <IconButton
                            edge="start"
                            color="inherit"
                            onClick={handleClose}
                            aria-label="close"
                        >
                            <GridCloseIcon />
                        </IconButton>
                        <Typography sx={{ ml: 2, flex: 1 }} variant="h6" component="div">
                            {"Reporte General"}
                        </Typography>

                    </Toolbar>
                </AppBar>
                <DialogContent>


                    <StyledDataGrid
                        //className="datagrid-content"
                        rows={list ? list : []}
                        columns={columns}
                        slots={{ toolbar: GridToolbar }}
                        hideFooterPagination
                        rowHeight={100}
                        disableRowSelectionOnClick
                        hideFooter
                        columnGroupingModel={columnGroupingModel}
                        slotProps={{ toolbar: { excelOptions } }}
                        getRowClassName={(params) => {
                            if (params.row.revicions.length >= 5) {
                                return 'custom-row-5'; // Clase CSS para el color deseado
                            }
                            else if (params.row.revicions.length >= 2) {
                                return 'custom-row-2'; // Clase CSS para el color deseado
                            }
                            else if (params.row.solucions.length > 0) {
                                return 'custom-row-0'; // Clase CSS para el color deseado
                            }
                            return 'custom-row-1';
                        }}
                    />
                </DialogContent>
            </Dialog>
            {cargando && (
                <Box sx={{ height: "100vh", width: "100vw", top: 0, left: 0, alignContent: "center", backgroundColor: 'rgba(0, 0, 0, 0.25)', position: "fixed", zIndex: "1301" }} >
                    <CircularProgress sx={{ color: "white" }} />
                </Box>
            )}
        </React.Fragment>
    )
}

export default ReporteGeneralDialog