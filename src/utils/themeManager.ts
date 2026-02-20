export const changeThemeColor = (color: string) => {
  document.documentElement.setAttribute("data-theme", color);
  localStorage.setItem("themeColor", color);
};

  
  // export const toggleDarkMode = (isDark: boolean) => {
  //   if (isDark) {
  //     document.body.classList.add("dark");
  //     document.body.classList.remove("light");
  //     document.documentElement.setAttribute("data-theme", "dark");
  //   } else {
  //     document.body.classList.add("light");
  //     document.body.classList.remove("dark");
  //     document.documentElement.setAttribute("data-theme", "light");
  //   }
  //   localStorage.setItem("themeMode", isDark ? "dark" : "light");
  // };

  export const toggleDarkMode = (isDark: boolean) => {
    if (isDark) {
        document.body.classList.add("dark");
        document.documentElement.setAttribute("data-theme", "dark");
    } else {
        document.body.classList.remove("dark");
        document.documentElement.setAttribute("data-theme", localStorage.getItem("themeColor") || "blue");
    }
    localStorage.setItem("themeMode", isDark ? "dark" : "light");
};

  
  export const loadThemeSettings = () => {
    const savedTheme = localStorage.getItem("themeColor") || "blue";
    const isDarkMode = localStorage.getItem("themeMode") === "dark";

    changeThemeColor(savedTheme);
    toggleDarkMode(isDarkMode);
};

  