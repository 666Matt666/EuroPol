<template>
  <v-container>
    <v-progress-linear indeterminate color="primary" v-if="loading"></v-progress-linear>
    <h1 class="text-h4 mb-4">Gestión de Presupuestos</h1>

    <!-- Formulario para Crear/Editar Presupuesto -->
    <v-card class="mb-8">
      <v-card-title>
        {{ isEditing ? 'Editar Presupuesto' : 'Crear Nuevo Presupuesto' }}
      </v-card-title>
      <v-card-text>
        <v-form @submit.prevent="handleSubmit">
          <fieldset :disabled="isFormDisabled">
            <v-row>
              <!-- Código del Presupuesto (solo visible al editar) -->
              <v-col v-if="isEditing" cols="12" md="6">
                <v-text-field
                  label="Código"
                  :model-value="form.codigo_presupuesto"
                  variant="outlined"
                  density="compact"
                  readonly
                ></v-text-field>
              </v-col>

              <!-- Selector de Cliente (Empresa) -->
              <v-col v-if="authStore.isSupervisor.value" cols="12" md="6">
                <v-select
                  label="Cliente"
                  v-model="form.cliente_empresa_id"
                  :items="empresas"
                  item-title="nombre"
                  item-value="id"
                  variant="outlined"
                  density="compact"
                  required
                ></v-select>
              </v-col>
              <v-col v-else cols="12" md="6">
                 <v-text-field
                  label="Cliente"
                  :model-value="authStore.state.user?.empresa_nombre"
                  variant="outlined"
                  density="compact"
                  readonly
                  hint="Los presupuestos se crean para tu propia empresa."
                  persistent-hint
                ></v-text-field>
              </v-col>

              <!-- Fecha de Vencimiento -->
              <v-col cols="12" md="6">
                <v-text-field
                  type="date"
                  label="Fecha de Vencimiento"
                  v-model="form.fecha_vencimiento"
                  variant="outlined"
                  density="compact"
                ></v-text-field>
              </v-col>
            </v-row>

            <!-- Sección para agregar ítems (productos) -->
            <v-divider class="my-4"></v-divider>
            
            <v-row>
              <!-- Columna Izquierda: Ítems del Presupuesto -->
              <v-col cols="12" md="7">
                <h3 class="text-h6 mb-3">Ítems del Presupuesto</h3>
                <div v-for="(item, index) in form.items" :key="index" class="d-flex align-center mb-3">
                  <v-select
                    class="me-2"
                    label="Seleccione un producto"
                    v-model="item.producto_id"
                    :items="productos"
                    item-title="nombre_producto"
                    item-value="id"
                    variant="outlined"
                    density="compact"
                    hide-details
                    @update:modelValue="onProductSelect(item, index)"
                    :ref="el => productSelects[index] = el"
                  >
                    <template v-slot:item="{ props, item: selItem }">
                      <v-list-item v-bind="props" :title="selItem.raw.nombre_producto">
                        <v-list-item-subtitle>{{ selItem.raw.ancho_cm }}x{{ selItem.raw.alto_cm }} cm</v-list-item-subtitle>
                      </v-list-item>
                    </template>
                  </v-select>

                  <v-text-field
                    class="me-2"
                    style="max-width: 120px;"
                    type="number"
                    label="Cantidad"
                    v-model.number="item.cantidad"
                    required
                    min="1"
                    variant="outlined"
                    density="compact"
                    hide-details
                    :ref="el => quantityInputs[index] = el"
                    @keydown.enter.prevent="focusAddItemButton"
                  ></v-text-field>

                  <v-text-field
                    style="max-width: 150px;"
                    prefix="$"
                    type="number"
                    label="Precio Unit."
                    v-model.number="item.precio_unitario"
                    variant="outlined"
                    density="compact"
                    readonly
                    hide-details
                  ></v-text-field>
                  <v-tooltip text="Quitar ítem">
                    <template v-slot:activator="{ props }">
                      <v-btn v-bind="props" icon="mdi-trash-can-outline" variant="text" color="red" @click="removeItem(index)"></v-btn>
                    </template>
                  </v-tooltip>
                </div>
                <div v-if="!isFormDisabled">
                  <v-btn
                    v-if="canAddItem"
                    variant="tonal"
                    size="small"
                    @click="addItem"
                    ref="addItemButtonRef"
                    prepend-icon="mdi-plus"
                  >
                    Añadir Ítem
                  </v-btn>
                </div>
              </v-col>

              <!-- Columna Derecha: Notas Generales -->
              <v-col cols="12" md="5">
                 <v-textarea
                    label="Notas Generales"
                    v-model="form.notas"
                    variant="outlined"
                    rows="5"
                    auto-grow
                  ></v-textarea>
              </v-col>
            </v-row>

            <!-- Pie del formulario con botones y total -->
            <div class="d-flex justify-space-between align-center mt-6">
              <div>
                <v-btn v-if="!isEditing || !isFormDisabled" type="submit" color="primary" :disabled="!isEditing && !hasValidItems">{{ submitButtonText }}</v-btn>
                
                <v-btn v-if="isEditing && authStore.isSupervisor.value && form.status === 'enviado'" color="success" class="me-2" @click="handleApprove(form.id)" prepend-icon="mdi-check-circle">Aprobar</v-btn>
                <v-btn v-if="isEditing && authStore.isSupervisor.value && form.status === 'enviado'" color="error" class="me-2" @click="handleReject(form.id)" prepend-icon="mdi-close-circle">Rechazar</v-btn>

                <v-btn v-if="isEditing" variant="text" @click="cancelEdit">Cancelar</v-btn>
              </div>
              
              <div v-if="totalPresupuesto > 0" class="text-end">
                <div class="text-h5">Total: <strong>$ {{ totalPresupuesto.toFixed(2) }}</strong></div>
              </div>
            </div>
          </fieldset>
        </v-form>
      </v-card-text>
    </v-card>

    <!-- Lista de Presupuestos -->
    <h2 class="text-h5 mb-4">Listado de Presupuestos</h2>
    <v-card v-if="!loading">
        <v-card-text>
            <vue-good-table
                :columns="columns"
                :rows="presupuestos"
                :search-options="{ enabled: true, placeholder: 'Buscar en la tabla...' }"
                :pagination-options="{ enabled: true, mode: 'records', perPage: 10, nextLabel: 'Siguiente', prevLabel: 'Anterior', rowsPerPageLabel: 'Filas por pág.', ofLabel: 'de' }"
                @row-click="onRowClick"
                v-if="presupuestos.length > 0"
            >
                <template #table-row="props">
                    <span v-if="props.column.field == 'status'">
                        <v-chip :color="statusBadge(props.row.status).color" variant="elevated" size="small">
                            {{ props.row.status }}
                        </v-chip>
                    </span>
                    <span v-else-if="props.column.field == 'acciones'">
                        <div class="d-flex" style="gap: 4px;">
                            <v-btn v-if="props.row.status === 'borrador'" size="small" color="info" @click.stop="startEdit(props.row)">Editar</v-btn>
                            <v-btn v-if="authStore.isSupervisor.value && props.row.status === 'enviado'" size="small" color="primary" @click.stop="startEdit(props.row)">Revisar</v-btn>
                            <v-btn v-if="props.row.status !== 'borrador' && props.row.status !== 'enviado'" size="small" @click.stop="startEdit(props.row)">Ver</v-btn>
                            <v-tooltip text="Confirmar y Enviar">
                                <template v-slot:activator="{ props }">
                                    <v-btn v-if="props.row.status === 'borrador'" v-bind="props" size="small" color="success" @click.stop="handleConfirm(props.row.id)" icon="mdi-send-check"></v-btn>
                                </template>
                            </v-tooltip>
                        </div>
                    </span>
                    <span v-else-if="props.column.field == 'fecha_vencimiento'">
                        {{ props.row.fecha_vencimiento ? new Date(props.row.fecha_vencimiento).toLocaleDateString() : 'N/A' }}
                    </span>
                    <span v-else-if="props.column.field == 'created_at'">
                        {{ new Date(props.row.created_at).toLocaleDateString() }}
                    </span>
                    <span v-else>
                        {{ props.formattedRow[props.column.field] }}
                    </span>
                </template>
            </vue-good-table>
            <v-alert v-else type="info" variant="tonal" class="mt-4" border="start" prominent icon="mdi-information-outline">
              No se encontraron presupuestos.
              <br>
              <small>Puedes crear uno nuevo utilizando el formulario de arriba.</small>
            </v-alert>
        </v-card-text>
    </v-card>
  </v-container>
</template>

<script setup>
import { ref, onMounted, reactive, computed, watch, nextTick } from 'vue';
import apiService from '../components/apiService.js';
import { authStore } from '../authStore.js';
import 'vue-good-table-next/dist/vue-good-table-next.css';
import { VueGoodTable } from 'vue-good-table-next';
import { useToast } from 'vue-toastification';

const toast = useToast();

// --- Estado y Datos ---
const presupuestos = ref([]);
const productos = ref([]);
const empresas = ref([]);
const loading = ref(false);
const error = ref(null);
const isEditing = ref(false);
const productSelects = ref([]);
const quantityInputs = ref([]);
const addItemButtonRef = ref(null);
let originalItemsOnEdit = [];
let originalNotesOnEdit = '';
let originalStatusOnEdit = null;
const hasChanges = ref(false);

const totalPresupuesto = computed(() => {
  return form.items.reduce((total, item) => {
    return total + (Number(item.cantidad) * Number(item.precio_unitario) || 0);
  }, 0);
});
const isFormDisabled = computed(() => {
  if (!isEditing.value) return false;
  if (authStore.isSupervisor.value && form.status === 'enviado') return false;
  if (form.status === 'borrador') return false;
  return true;
});

const hasValidItems = computed(() => form.items.some(item => item.producto_id && Number(item.cantidad) > 0));

const canAddItem = computed(() => {
  if (form.items.length === 0) return true;
  const lastItem = form.items[form.items.length - 1];
  return lastItem.producto_id && Number(lastItem.cantidad) > 0;
});

const submitButtonText = computed(() => {
  if (!isEditing.value) return 'Crear Presupuesto';
  if (authStore.isSupervisor.value && originalStatusOnEdit === 'enviado' && hasChanges.value) {
    return 'Actualizar y devolver';
  }
  return 'Actualizar Presupuesto';
});

const columns = computed(() => {
  const baseColumns = [
    { label: 'Fecha Creación', field: 'created_at', type: 'date', dateInputFormat: "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", dateOutputFormat: 'dd/MM/yyyy' },
    { label: 'Fecha Vencimiento', field: 'fecha_vencimiento', type: 'date', dateInputFormat: 'yyyy-MM-dd', dateOutputFormat: 'dd/MM/yyyy' },
    { label: 'Estado', field: 'status' },
    { label: 'Acciones', field: 'acciones', sortable: false, tdClass: 'text-center' }
  ];
  if (authStore.isSupervisor.value) {
    return [
      { label: 'Cliente', field: 'cliente_nombre' },
      { label: 'Creado por', field: 'creador_email' },
      { label: 'N° presupuesto', field: 'codigo_presupuesto' },
      ...baseColumns
    ];
  }
  return [
      { label: 'N° presupuesto', field: 'codigo_presupuesto' },
      { label: 'Cliente', field: 'cliente_nombre' },
      { label: 'Creado por', field: 'creador_email' },
      ...baseColumns
  ];
});

const onRowClick = (params) => startEdit(params.row);

const statusBadge = (status) => {
  const classes = {
    borrador: { color: 'grey' },
    enviado: { color: 'blue' },
    aprobado: { color: 'success' },
    rechazado: { color: 'error' },
  };
  return classes[status] || { color: 'dark' };
};

const getCleanForm = () => ({
  id: null,
  cliente_empresa_id: '',
  codigo_presupuesto: '',
  fecha_vencimiento: '',
  notas: '',
  items: [{ producto_id: '', cantidad: 1, precio_unitario: 0 }],
  status: 'borrador',
});

const form = reactive(getCleanForm());

const fetchData = async () => {
  loading.value = true;
  error.value = null;
  try {
    const [presupuestosRes, productosRes, empresasRes] = await Promise.all([
      apiService.getPresupuestos(),
      apiService.getProductos(),
      authStore.isSupervisor.value ? apiService.getEmpresas() : Promise.resolve({ data: [] })
    ]);
    presupuestos.value = presupuestosRes.data;
    productos.value = productosRes.data;
    empresas.value = empresasRes.data;
  } catch (err) {
    error.value = 'Error al cargar los datos iniciales.';
    toast.error(error.value);
    console.error(err);
  } finally {
    loading.value = false;
  }
};

const onProductSelect = (item, index) => {
  const selectedProduct = productos.value.find(p => p.id === item.producto_id);
  if (selectedProduct) {
    item.precio_unitario = selectedProduct.precio_base;
  }
  nextTick(() => {
    if (quantityInputs.value[index]) {
      quantityInputs.value[index].focus();
    }
  });
};

const addItem = () => {
  form.items.push({ producto_id: '', cantidad: 1, precio_unitario: 0 });
  nextTick(() => {
    const lastIndex = form.items.length - 1;
    if (productSelects.value[lastIndex]) {
      productSelects.value[lastIndex].focus();
    }
  });
};

const removeItem = (index) => {
  if (form.items.length > 1) {
    form.items.splice(index, 1);
  } else {
    toast.warning('Un presupuesto debe tener al menos un ítem.');
  }
};

const focusAddItemButton = () => {
  if (addItemButtonRef.value) {
    addItemButtonRef.value.$el.focus();
  }
};

const resetForm = () => {
  Object.assign(form, getCleanForm());
  if (!authStore.isSupervisor.value) {
    form.cliente_empresa_id = authStore.state.user?.empresa_id;
  }
  isEditing.value = false;
  hasChanges.value = false;
  originalItemsOnEdit = [];
  originalNotesOnEdit = '';
  originalStatusOnEdit = null;
};

const handleSubmit = async () => {
  if (!hasValidItems.value) {
    toast.error('Debe añadir al menos un producto válido al presupuesto.');
    return;
  }

  const payload = {
    ...form,
    items: form.items.filter(item => item.producto_id && Number(item.cantidad) > 0)
  };

  if (!payload.cliente_empresa_id && !authStore.isSupervisor.value) {
      payload.cliente_empresa_id = authStore.state.user?.empresa_id;
  }

  try {
    if (isEditing.value) {
      await apiService.updatePresupuesto(form.id, payload);
      toast.success('Presupuesto actualizado correctamente.');
    } else {
      await apiService.createPresupuesto(payload);
      toast.success('Presupuesto creado correctamente.');
    }
    resetForm();
    await fetchData();
  } catch (err) {
    const message = err.response?.data?.message || `Error al ${isEditing.value ? 'actualizar' : 'crear'} el presupuesto.`;
    toast.error(message);
    console.error(err);
  }
};

const startEdit = (presupuesto) => {
  isEditing.value = true;
  form.id = presupuesto.id;
  form.codigo_presupuesto = presupuesto.codigo_presupuesto;
  form.cliente_empresa_id = presupuesto.cliente_empresa_id;
  form.fecha_vencimiento = presupuesto.fecha_vencimiento ? presupuesto.fecha_vencimiento.split('T')[0] : '';
  form.notas = presupuesto.notas;
  form.status = presupuesto.status;
  form.items = presupuesto.items.length > 0 ? JSON.parse(JSON.stringify(presupuesto.items)) : [{ producto_id: '', cantidad: 1, precio_unitario: 0 }];

  originalItemsOnEdit = JSON.parse(JSON.stringify(form.items));
  originalNotesOnEdit = form.notas;
  originalStatusOnEdit = form.status;
  hasChanges.value = false;
  
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const cancelEdit = () => {
  resetForm();
};

const handleConfirm = async (id) => {
  if (confirm('¿Estás seguro de que quieres confirmar y enviar este presupuesto? No podrás editarlo después.')) {
    try {
      await apiService.updatePresupuestoStatus(id, { status: 'enviado' });
      toast.success('Presupuesto enviado para aprobación.');
      await fetchData();
    } catch (err) {
      toast.error('Error al enviar el presupuesto.');
      console.error(err);
    }
  }
};

const handleApprove = async (id) => {
    try {
      await apiService.updatePresupuestoStatus(id, { status: 'aprobado' });
      toast.success('Presupuesto aprobado.');
      resetForm();
      await fetchData();
    } catch (err) {
      toast.error('Error al aprobar el presupuesto.');
      console.error(err);
    }
};

const handleReject = async (id) => {
    try {
      await apiService.updatePresupuestoStatus(id, { status: 'rechazado' });
      toast.info('Presupuesto rechazado.');
      resetForm();
      await fetchData();
    } catch (err) {
      toast.error('Error al rechazar el presupuesto.');
      console.error(err);
    }
};

watch(form, (newVal) => {
  if (!isEditing.value) return;
  const itemsChanged = JSON.stringify(newVal.items) !== JSON.stringify(originalItemsOnEdit);
  const notesChanged = newVal.notas !== originalNotesOnEdit;
  hasChanges.value = itemsChanged || notesChanged;
}, { deep: true });

onMounted(() => {
    fetchData();
    if (!authStore.isSupervisor.value) {
      form.cliente_empresa_id = authStore.state.user?.empresa_id;
    }
});

</script>

<style scoped>
/* Puedes añadir estilos específicos de Vuetify si es necesario */
</style>