export default function Card({children}){

  return(

    <div style={{
      background:"white",
      padding:"30px",
      borderRadius:"10px",
      width:"350px",
      boxShadow:"0 4px 10px rgba(0,0,0,0.1)"
    }}>

      {children}

    </div>

  )

}