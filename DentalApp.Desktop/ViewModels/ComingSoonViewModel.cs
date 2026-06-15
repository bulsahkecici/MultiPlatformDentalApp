using DentalApp.Desktop.Helpers;
using MaterialDesignThemes.Wpf;

namespace DentalApp.Desktop.ViewModels
{
    public class ComingSoonViewModel : ObservableObject
    {
        public string Title { get; }
        public string Description { get; }
        public PackIconKind Icon { get; }

        public ComingSoonViewModel(string title, string description, PackIconKind icon)
        {
            Title = title;
            Description = description;
            Icon = icon;
        }
    }
}
