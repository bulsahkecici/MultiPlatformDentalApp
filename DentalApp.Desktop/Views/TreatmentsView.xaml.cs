using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;

namespace DentalApp.Desktop.Views
{
    public partial class TreatmentsView : UserControl
    {
        public TreatmentsView()
        {
            InitializeComponent();
        }

        private void DataGrid_MouseDoubleClick(object sender, MouseButtonEventArgs e)
        {
            try
            {
                if (e.OriginalSource is FrameworkElement element && element.DataContext != null)
                {
                    var viewModel = DataContext as ViewModels.TreatmentsViewModel;
                    if (viewModel != null)
                    {
                        // Set selected treatment from the clicked row
                        if (element.DataContext is Models.Treatment treatment)
                        {
                            viewModel.SelectedTreatment = treatment;
                        }
                        
                        // Execute edit command if it can execute
                        if (viewModel.EditTreatmentCommand.CanExecute(null))
                        {
                            viewModel.EditTreatmentCommand.Execute(null);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Tedavi açılırken hata: {ex.Message}\n\nDetay: {ex.StackTrace}", "Hata", 
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private DateTime _lastClickTime = DateTime.MinValue;
        private object? _lastClickedItem = null;

        private void TreatmentItem_MouseDown(object sender, MouseButtonEventArgs e)
        {
            try
            {
                if (sender is Border border && border.DataContext is Models.Treatment treatment)
                {
                    var now = DateTime.Now;
                    var timeSinceLastClick = (now - _lastClickTime).TotalMilliseconds;
                    
                    // Double-click kontrolü (500ms içinde aynı item'a tıklanmışsa)
                    if (_lastClickedItem == treatment && timeSinceLastClick < 500)
                    {
                        var viewModel = DataContext as ViewModels.TreatmentsViewModel;
                        if (viewModel != null)
                        {
                            viewModel.SelectedTreatment = treatment;
                            if (viewModel.EditTreatmentCommand.CanExecute(null))
                            {
                                viewModel.EditTreatmentCommand.Execute(null);
                            }
                        }
                        _lastClickedItem = null;
                        _lastClickTime = DateTime.MinValue;
                    }
                    else
                    {
                        _lastClickedItem = treatment;
                        _lastClickTime = now;
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Tedavi açılırken hata: {ex.Message}", "Hata", 
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void TreeView_SelectedItemChanged(object sender, RoutedPropertyChangedEventArgs<object> e)
        {
            try
            {
                var viewModel = DataContext as ViewModels.TreatmentsViewModel;
                if (viewModel != null && e.NewValue is Models.Treatment treatment)
                {
                    viewModel.SelectedTreatment = treatment;
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Seçim hatası: {ex.Message}", "Hata", 
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
    }
}
