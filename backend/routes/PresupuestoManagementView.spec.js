import { mount } from '@vue/test-utils';
import PresupuestoManagementView from './PresupuestoManagementView.vue';
import { authStore } from '../authStore';

// Mock del authStore para controlar el estado del usuario en las pruebas
jest.mock('../authStore', () => ({
  authStore: {
    isSupervisor: { value: false },
    state: {
      user: { role: 'usuario' }
    }
  }
}));

// Mock de vue-toastification
jest.mock('vue-toastification', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  }),
}));

describe('PresupuestoManagementView.vue', () => {

  it('la propiedad computada isFormDisabled funciona correctamente para un operador', async () => {
    // Montamos el componente
    const wrapper = mount(PresupuestoManagementView, {
      global: {
        stubs: ['vue-good-table'] // Usamos stubs para componentes hijos complejos
      }
    });

    // Caso 1: Creando un nuevo presupuesto (no editando)
    // El formulario debe estar HABILITADO
    expect(wrapper.vm.isFormDisabled).toBe(false);

    // Caso 2: Editando un presupuesto en estado 'borrador'
    await wrapper.vm.form.status = 'borrador';
    await wrapper.vm.isEditing = true;
    // El formulario debe estar HABILITADO
    expect(wrapper.vm.isFormDisabled).toBe(false);

    // Caso 3: Editando (viendo) un presupuesto en estado 'aprobado'
    await wrapper.vm.form.status = 'aprobado';
    await wrapper.vm.isEditing = true;
    // El formulario debe estar DESHABILITADO
    expect(wrapper.vm.isFormDisabled).toBe(true);
  });

});