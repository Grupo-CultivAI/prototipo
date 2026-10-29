import Navbar from "@/components/Navbar";
import FaleConosco from "@/components/FaleConosco";

export default function PublicLayout({ children }) {
    return (
        <>
            <Navbar />
            <main>
                {children}
            </main>
            <FaleConosco />
        </>
    );
}
